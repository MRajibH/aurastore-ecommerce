# AURA Store — Technical Guide & System Design

A production-grade e-commerce storefront built with **Next.js 16 (App Router)**, **TypeScript**, **better-sqlite3**, and **zod**. It ships a full customer storefront (catalog, product pages, cart, guest/authenticated checkout, reviews, account dashboard), a complete **admin panel**, and a marketing stack (SEO, Meta Pixel + Conversions API + catalog feed, email lifecycle, discounts).

This document explains **how the system is designed and implemented** so any developer can understand it and extend it safely.

---

## Table of Contents

1. [Quick start](#1-quick-start)
2. [Environment variables](#2-environment-variables)
3. [Tech stack & why](#3-tech-stack--why)
4. [Architecture overview](#4-architecture-overview)
5. [Directory structure](#5-directory-structure)
6. [Rendering model](#6-rendering-model)
7. [Data layer & database schema](#7-data-layer--database-schema)
8. [Domain modules (`src/lib`)](#8-domain-modules-srclib)
9. [Authentication & sessions](#9-authentication--sessions)
10. [Security model](#10-security-model)
11. [Key end-to-end flows](#11-key-end-to-end-flows)
12. [Marketing & SEO stack](#12-marketing--seo-stack)
13. [Theming (light/dark)](#13-theming-lightdark)
14. [Coding conventions](#14-coding-conventions)
15. [Extension recipes](#15-extension-recipes)
16. [Known limitations & production checklist](#16-known-limitations--production-checklist)
17. [Deployment](#17-deployment)

---

## 1. Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The SQLite database is created and seeded automatically on first run (see [`src/lib/db/init.ts`](src/lib/db/init.ts)).

**Seeded admin account:** `admin@ecom.com` / `adminpassword123`

Scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

> **Heads-up (see `AGENTS.md`):** this is Next.js **16** — APIs (async `params`/`cookies`, `generateMetadata`, metadata file conventions) differ from older majors. Check `node_modules/next/dist/docs/` before assuming an older API.

---

## 2. Environment variables

Everything works out of the box with **no env vars** (payments are mocked, emails log to a DB outbox, Meta tracking is inert). Copy `.env.example` to `.env.local` to enable integrations:

| Variable | Enables |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs in SEO/feed/OpenGraph (defaults to `http://localhost:3000`) |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Meta Pixel (browser) + is the CAPI dataset id |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversions API (server-side events) |
| `META_CATALOG_ID`, `META_BRAND_NAME`, `META_TEST_EVENT_CODE` | Catalog feed / CAPI test tooling |
| `META_FEED_TOKEN` | Require `?token=` on the catalog feed |
| `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_MBE_CONFIG_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI` | One-click "Connect with Facebook" (MBE) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Actually deliver emails (else they queue in the outbox) |

Most of these can also be set at runtime from **Admin → Marketing** (stored in `meta_settings`); env vars act as defaults/fallbacks.

---

## 3. Tech stack & why

- **Next.js 16 App Router** — server components for data-close rendering, file-based routing, built-in image optimization, metadata conventions.
- **TypeScript** — typed domain models and DTOs end to end.
- **better-sqlite3** — synchronous, in-process SQL. Zero-ops for development and small single-instance deploys. Access is isolated behind query modules so it can be swapped for Postgres (see [recipe](#migrate-sqlite--postgres)).
- **zod** — runtime validation at every request boundary; schemas double as TypeScript types.
- **CSS Modules + CSS custom properties** — component-scoped styles with a single themable design-token system in [`globals.css`](src/app/globals.css). No CSS framework dependency.
- **scrypt** (Node `crypto`) — password hashing; no external auth dependency.

---

## 4. Architecture overview

The app is **layered** and **modular** so business logic is testable and portable, and route handlers stay thin.

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation                                                │
│  app/**/page.tsx (Server Components)  ─┐                     │
│  components/*.tsx  ('use client' where interactive)          │
│  context/CartContext (client cart state)                     │
└───────────────┬──────────────────────────────────────────────┘
                │ props / fetch
┌───────────────▼──────────────────────────────────────────────┐
│  API layer  app/api/**/route.ts                               │
│  - authz check → zod validate → call domain module → respond  │
│  - thin; no business logic beyond orchestration               │
└───────────────┬──────────────────────────────────────────────┘
                │ typed function calls
┌───────────────▼──────────────────────────────────────────────┐
│  Domain modules  src/lib/*                                    │
│  reviews · discounts · checkout(pricing) · email · abandoned  │
│  meta(capi) · security · auth · legal · site/config           │
│  - own their types, validation, and queries                   │
└───────────────┬──────────────────────────────────────────────┘
                │ prepared statements
┌───────────────▼──────────────────────────────────────────────┐
│  Data  src/lib/db (better-sqlite3 singleton + schema/seed)    │
└───────────────────────────────────────────────────────────────┘

           Cross-cutting: src/middleware.ts
           (security headers, CSP, CSRF/Origin check)
```

**Guiding principle:** a route handler authenticates, validates input with zod, delegates to a domain module, and formats the response. All real logic (pricing, discount validation, review moderation, email dispatch) lives in `src/lib/*` with a typed public API — so the same logic could back a future GraphQL API, cron job, or multi-tenant SaaS.

---

## 5. Directory structure

```
src/
├── middleware.ts                 # Security headers + CSP + CSRF origin check (all routes)
├── app/
│   ├── layout.tsx                # Root layout: session→Navbar, Footer, ConsentBanner, Pixel, theme script
│   ├── page.tsx                  # Home: carousel + catalog + Org/WebSite JSON-LD
│   ├── globals.css               # Design tokens + base component classes + dark theme
│   ├── sitemap.ts / robots.ts    # SEO route files
│   ├── opengraph-image.tsx       # Generated default OG image (next/og)
│   ├── icon.svg                  # Favicon (brand mark)
│   ├── products/[id]/            # PDP: page (data + JSON-LD) + ProductDetailsClient + ProductReviews
│   ├── checkout/                 # page (guest allowed) + CheckoutClient
│   ├── profile/                  # account dashboard (page + ProfileClient)
│   ├── admin/                    # page (server queries) + AdminClient (tabbed UI)
│   ├── about / contact / privacy / terms / cookies / shipping-returns
│   ├── login / signup
│   └── api/                      # Route handlers (see §11)
├── components/                   # Presentational + interactive components
├── context/CartContext.tsx       # Client cart (localStorage-backed)
└── lib/
    ├── site.ts                   # Site name/URL/description helpers
    ├── db/{client,init}.ts        # DB singleton + schema/migrations/seed
    ├── auth/{hash,session}.ts     # scrypt hashing + session validation
    ├── consent.ts                # Cookie-consent read/write (client + server)
    ├── security/rate-limit.ts     # In-memory rate limiter + brute-force lockout
    ├── reviews/                  # Reviews domain (types + service)
    ├── discounts/                # Discount codes domain
    ├── checkout/{config,pricing,cart}.ts   # Pricing engine + shipping/tax config
    ├── email/                    # Provider abstraction + templates + outbox
    ├── abandoned.ts              # Abandoned-cart capture/recovery
    ├── meta/{capi,settings}.ts    # Conversions API + connection settings
    ├── fbpixel.ts                # Browser Pixel + CAPI dedup helpers
    ├── legal/content.ts          # Policy page content registry
    └── uploads.ts                # Shared image-upload validation/persistence
```

---

## 6. Rendering model

- **Server Components by default.** Pages query the DB directly on the server (e.g. `page.tsx` files) and pass plain data to client components.
- **Client Components** (`'use client'`) are used only where interactivity is needed (cart, forms, gallery, theme toggle, catalog filters).
- **Dynamic rendering:** the root layout ([`layout.tsx`](src/app/layout.tsx)) reads the session cookie (`validateSession()`) to personalize the navbar, so pages render per-request. With an in-process SQLite DB this is effectively free. Static assets (`icon.svg`, `opengraph-image`, `robots.txt`) and the legal pages are prerendered.
- **Serialization boundary:** anything passed from a Server Component to a Client Component must be JSON-serializable. Domain services return plain objects/arrays (never `Map`, `Date` instances across the boundary — those are converted first).

---

## 7. Data layer & database schema

### Client & initialization
[`src/lib/db/client.ts`](src/lib/db/client.ts) exports a **singleton** better-sqlite3 connection (cached on `globalThis` to survive hot reloads), enables WAL + foreign keys, and kicks off [`init.ts`](src/lib/db/init.ts). `initDb()` is **idempotent**: it `CREATE TABLE IF NOT EXISTS`, runs additive migrations (via `PRAGMA table_info` guards), performs one table rebuild (orders, for guest checkout), and seeds demo data only when tables are empty.

The DB file lives at `data/ecommerce.db` (gitignored).

### Schema (core tables)

| Table | Purpose | Notable columns |
|---|---|---|
| `users` | Accounts | `role` (`customer`/`admin`), `password_hash`, `avatar_url`, `phone`, `bio`, `address` |
| `sessions` | Auth sessions | `id` = **SHA-256 of cookie token**, `user_id`, `expires_at` |
| `products` | Catalog | `price`, `stock`, `image_url` (primary), `category` |
| `product_images` | Gallery | `product_id`, `url`, `sort_order` |
| `orders` | Orders | `user_id` (nullable → **guest**), `guest_email/name`, `subtotal`, `discount_*`, `shipping_amount`, `tax_amount`, `total_amount`, `status`, `notes` |
| `order_items` | Line items | `order_id`, `product_id`, `quantity`, `price` |
| `carousel_slides` | Home hero | `title`, `subtitle`, `image_url`, `link_url`, `display_order`, `is_active` |
| `reviews` | Product reviews | `rating`, `status` (`pending`/`approved`/`rejected`), `verified` |
| `discounts` | Promo codes | `code`, `type` (`percent`/`fixed`), `value`, `min_subtotal`, `usage_limit`, `used_count` |
| `email_subscribers` | Newsletter | `email`, `status`, `source` |
| `emails` | **Outbox** | `to_email`, `type`, `status` (`queued`/`sent`/`failed`) |
| `abandoned_carts` | Recovery | `email`, `items_json`, `subtotal`, `recovered` |
| `contact_messages` | Contact form | `name`, `email`, `message` |
| `meta_settings` | Marketing config | single row (`default`): pixel/token/catalog/brand/site |

All queries use **parameter binding** (no string interpolation) → no SQL injection. Multi-write operations use `db.transaction(...)`.

---

## 8. Domain modules (`src/lib`)

Each module owns its **types**, **validation**, and **DB access** behind a small typed API. Route handlers import these; they never write ad-hoc SQL for a domain that has a module.

| Module | Public API (selected) | Responsibility |
|---|---|---|
| `reviews/` | `getApprovedReviews`, `getReviewSummary`, `getSummariesForProducts` (batched), `createReview`, `listReviews`, `setReviewStatus` | Reviews + ratings + moderation. `verified` derived from order history. |
| `discounts/` | `validateDiscount(code, subtotal)`, `getDiscountByCode`, `incrementDiscountUsage`, admin CRUD | Promo-code rules (active/date/usage/min-subtotal) |
| `checkout/pricing.ts` | `computePricing({items, discount, shippingMethodId})` → `PriceBreakdown` | **Server-authoritative** subtotal/discount/shipping/tax/total. Pure & unit-testable. |
| `checkout/config.ts` | `FREE_SHIPPING_THRESHOLD`, `SHIPPING_METHODS`, `TAX_RATE` | Commerce config (shared client+server) |
| `checkout/cart.ts` | `resolveLineItems(cart)` | Resolves client cart → DB prices (never trusts client price) |
| `email/` | `sendEmail(msg)`, `subscribeEmail`, templates | Pluggable provider + durable outbox |
| `abandoned.ts` | `upsertAbandonedCart`, `markRecoveredByEmail`, `listAbandonedCarts` | Cart recovery |
| `meta/capi.ts` | `sendCapiEvent`, `extractUserDataFromRequest`, `hashData` | Server-side Conversions API (SHA-256 advanced matching) |
| `meta/settings.ts` | `getMetaSettings`, `updateMetaSettings` | DB+env merged marketing config |
| `security/rate-limit.ts` | `enforceRateLimit`, `rateLimit`, `getClientIp` | Rate limiting + brute-force lockout |
| `auth/` | `hashPassword`/`verifyPassword`, `createSession`/`validateSession`/`destroySession` | Auth primitives |
| `consent.ts` | `getConsent`/`setConsent` (client), `hasConsent(request)` (server) | GDPR consent gate |
| `legal/content.ts` | `getLegalDoc`, `legalMetadata` | Policy content registry |
| `uploads.ts` | `saveImageUpload(file, subdir)` | Validated image persistence (used by product + avatar upload) |

---

## 9. Authentication & sessions

- **Passwords:** `scrypt` with per-user salt, stored as `salt.hash`; verified with `timingSafeEqual` ([`auth/hash.ts`](src/lib/auth/hash.ts)).
- **Sessions:** a random 32-byte token is set as an **HttpOnly, SameSite=strict** cookie. Only the **SHA-256 of the token** is stored in `sessions` — a DB leak can't reconstruct valid cookies ([`auth/session.ts`](src/lib/auth/session.ts)).
- `validateSession()` is called in the root layout (navbar), in server pages needing the user, and in every mutating API route.
- Password change **invalidates all other sessions** for the user.
- Client auth transitions use a **full navigation** (`window.location.assign`) after login/logout so the server-rendered layout re-reads the cookie (avoids stale personalization).

---

## 10. Security model

Defense-in-depth, enforced centrally where possible:

- **Middleware** ([`src/middleware.ts`](src/middleware.ts)) sets on every response: `Content-Security-Policy` (allowlists self + Meta domains), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (prod). It also **blocks cross-site mutations**: any non-GET `/api` request whose `Origin` host ≠ site host → `403`.
- **CSRF:** the Origin check above + `SameSite=strict` cookies.
- **Rate limiting / brute force:** `enforceRateLimit` on login, signup, contact, newsletter, reviews; login additionally locks an account after 5 failed attempts / 15 min.
- **Input validation:** zod at every request boundary.
- **SQL:** parameterized everywhere.
- **AuthZ:** admin routes check `session.user.role === 'admin'`.
- **Consent-gated tracking:** no Meta event (browser or server) fires without `aura_consent=granted`.

---

## 11. Key end-to-end flows

### Checkout (`POST /api/checkout`)
1. `validateSession()` (optional — **guests allowed**; guests must send `name`+`email`).
2. zod-validate `{ shippingAddress, cartItems, shippingMethod, discountCode?, notes?, name?, email? }`.
3. In a **transaction**: resolve each product from DB, verify stock, decrement stock, validate the discount against the true subtotal, `computePricing()`, insert `orders` + `order_items`, increment discount usage.
4. Fire-and-forget: order-confirmation email, mark abandoned cart recovered, and (consent-gated) a server-side **Purchase** CAPI event.
5. Return `{ orderId, breakdown, purchase:{eventId,...} }`. The client fires the browser Pixel `Purchase` with the **same `eventId`** so Meta deduplicates.

### Cart quote (`POST /api/cart/quote`)
Server recomputes the full price breakdown from DB prices + validates the promo code. The checkout UI calls this for live totals; the final checkout **re-validates** independently (never trusts the quote).

### Review submission (`POST /api/products/[id]/reviews`)
Rate-limited → auth required → zod → dup check → `createReview` (status `pending`, `verified` from order history) → appears publicly only after admin approval. Approved reviews feed the PDP `AggregateRating` JSON-LD.

### Meta event dedup (`fbTrackWithCapi`)
[`src/lib/fbpixel.ts`](src/lib/fbpixel.ts) generates one `eventId`, fires the browser Pixel with `{eventID}`, and POSTs the same event to `/api/meta/track` which sends it via CAPI with identical `event_id` + `content_ids` → Meta merges the two.

---

## 12. Marketing & SEO stack

- **Metadata:** `metadataBase` + title template in the root layout; per-product `generateMetadata` (title, canonical, OpenGraph using the real product image).
- **Structured data (JSON-LD):** `Product` + `Offer` + `AggregateRating` + `BreadcrumbList` on PDPs; `OnlineStore` + `WebSite` + `SearchAction` on home.
- **OG image:** branded image generated at `/opengraph-image` via `next/og`.
- **`sitemap.ts` / `robots.ts`:** dynamic sitemap (home + products + policies); robots disallows private/API/transactional paths.
- **Meta catalog feed:** `GET /api/catalog/feed` outputs Google/Meta RSS 2.0 XML (`g:id` = product SKU, price, availability, `additional_image_link`, `mpn`). Add it as a scheduled feed in Commerce Manager.
- **Pixel + CAPI:** `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Search`, `PageView` — browser + server, deduped, consent-gated.

---

## 13. Theming (light/dark)

- All colors are CSS custom properties in `:root` (light) with a `[data-theme="dark"]` override block in [`globals.css`](src/app/globals.css).
- A tiny **pre-paint script** in `layout.tsx` sets `data-theme` from `localStorage` (or `prefers-color-scheme`) before first paint → no flash. `<html suppressHydrationWarning>` accounts for the attribute.
- [`ThemeToggle.tsx`](src/components/ThemeToggle.tsx) flips and persists the choice.
- **Rule:** components consume theme via variables (`var(--text-primary)`, `var(--surface)`, `var(--border-color)`…). Only intentionally theme-independent surfaces (e.g. the light hero carousel) hardcode colors — with a comment saying why.

---

## 14. Coding conventions

- **Thin routes, fat modules.** Business logic lives in `src/lib/*`, not in `route.ts`.
- **Validate at the boundary** with zod; export the inferred type.
- **Never trust the client** for prices, stock, roles, or identity — recompute/verify server-side.
- **Typed data.** Prefer explicit interfaces; avoid `any` in new code (there is some legacy `any` from the original scaffold — improve as you touch it).
- **Styling:** one CSS Module per component; shared tokens/utilities in `globals.css`. Use `var(--…)` tokens, not hardcoded colors.
- **Money:** compute in the pricing engine; round with the shared helper; store the full breakdown on the order.
- **Images:** use `next/image` (`fill` + `sizes`, `priority` for LCP) for customer-facing images.

---

## 15. Extension recipes

### Add a field to products
1. Add the column in `init.ts` (inside the `CREATE TABLE` and, for existing DBs, an `addColumn` migration guard).
2. Extend the zod schema in `app/api/admin/products/route.ts` + `[id]/route.ts` and the `INSERT`/`UPDATE`.
3. Surface it in the admin product form (`AdminClient.tsx`) and on the PDP.

### Add a new API endpoint
Create `app/api/<path>/route.ts`, export `GET/POST/...`. Pattern: `requireAuth?` → `enforceRateLimit?` → `zod.safeParse` → call a `src/lib` module → `NextResponse.json`.

### Add a new domain module
Create `src/lib/<domain>/{types.ts,service.ts,index.ts}`. Put zod schemas + interfaces in `types.ts`, DB access in `service.ts`. Keep it framework-agnostic (no `next/*` imports) so it stays testable.

### Add a Meta standard event
Call `fbTrackWithCapi('EventName', customData)` from the client (dedup handled), or `sendCapiEvent(...)` server-side for authoritative events. Keep `content_ids` = product SKUs.

### <a id="migrate-sqlite--postgres"></a>Migrate SQLite → Postgres
Data access is centralized in `src/lib/db/client.ts` + the `service.ts` files. Swap the client for a Postgres pool (e.g. `pg`/Drizzle), translate the prepared statements, and port `init.ts` to migrations (Drizzle/Prisma). No presentation code changes. Then you can add ISR + `revalidateTag` since the DB is no longer in-process.

### Add real payments (Stripe)
Replace the mock card form in `CheckoutClient.tsx` with Stripe Elements/Checkout; move order creation to a **webhook** (`/api/webhooks/stripe`) that runs the existing checkout transaction on `payment_intent.succeeded`. The pricing/stock/order logic in `/api/checkout` is reusable as-is.

### Add tests
Domain modules are pure/DB-scoped — unit-test `computePricing`, `validateDiscount`, `getReviewSummary` with a temp SQLite file. Add Playwright for the checkout/review flows (the manual QA during development mirrors these).

---

## 16. Known limitations & production checklist

Honest status — this is a strong MVP, not yet a live money-taking store:

- [ ] **Payments are mocked** — integrate Stripe before launch (biggest blocker).
- [ ] **No automated test suite / CI** in the repo.
- [ ] **SQLite** — migrate to Postgres for scale / serverless / horizontal scaling.
- [ ] **Rate limiter is in-memory** — use Redis for multi-instance.
- [ ] Email requires `RESEND_API_KEY`; Meta features require real IDs/tokens (a Meta App for one-click connect).
- [ ] Tax is a flat configurable rate (no tax-jurisdiction engine); single admin role (no 2FA/audit log); no i18n/multi-currency; no shipping-carrier integration.
- [ ] Some legacy `any` types from the original scaffold remain.

---

## 17. Deployment

- **Vercel** is the natural target for Next.js — **but** `better-sqlite3` needs a persistent filesystem, which Vercel's serverless functions don't provide. For a real deploy, either (a) run on a VM/container (Render, Fly.io, Railway, a VPS) where the SQLite file persists, or (b) migrate to Postgres (recommended) and deploy anywhere.
- Set the env vars from §2. Set `NEXT_PUBLIC_SITE_URL` to the real origin (drives SEO, feed, and OG absolute URLs).
- `npm run build && npm run start` behind a reverse proxy (Nginx/Caddy) with HTTPS. HSTS turns on automatically in production.

---

*Admin: `admin@ecom.com` / `adminpassword123`. Built as a layered, modular system so features are added by composing typed domain modules — start in `src/lib`, wire a thin route, render in a component.*
