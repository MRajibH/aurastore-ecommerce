# Session Handoff — AURA Store

> **Purpose:** Paste/point a fresh Claude session at this file to resume exactly where we left off, on any device. Read `README.md` for the full technical/system-design guide; this file is the *session continuity* summary — status, decisions, gotchas, and next steps.

---

## TL;DR

**AURA Store** is a production-grade Next.js 16 e-commerce platform. An 8-phase upgrade is **complete** — every audit category went from failing/mediocre to A+. The production build passes. Code is pushed to GitHub. Remaining work is optional enhancement (real payments, tests, Postgres).

- **Repo:** https://github.com/MRajibH/Ecomerce-special.git (branch `main`)
- **Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · better-sqlite3 · zod · CSS Modules
- **Run:** `npm install && npm run dev` → http://localhost:3000 (DB auto-seeds)
- **Admin login:** `admin@ecom.com` / `adminpassword123`
- **Build:** `npm run build` (passes clean, exit 0)

---

## How to resume with Claude (new session)

Tell the new session something like:

> "Read `HANDOFF.md` and `README.md` in this repo. This is the AURA Store project — an 8-phase e-commerce build that's complete. Continue from the 'Next steps' section. Follow the code-quality bar in HANDOFF. Run `npm run dev` to start."

Claude should then: read both docs, `npm install`, `npm run dev`, and pick a next-step task.

---

## Working agreements (the quality bar — keep following these)

Expert/production grade, written so it can become a multi-tenant SaaS:

- **Modular & layered:** thin route handlers → typed `src/lib/*` domain modules → DB. New domains get their own `lib/<domain>/{types,service,index}.ts`.
- **Strongly typed:** avoid `any` in new code; zod-validate all external input at the boundary.
- **SaaS-ready seams:** read config via helpers/env/settings (don't hardcode); keep DB access behind query modules so SQLite→Postgres is a contained swap.
- **Secure by default:** parameterized SQL, authz on every mutation, hashed secrets, consent-gated tracking, rate limiting, never trust the client for price/stock/role/identity.
- **Fast & efficient:** `next/image`, avoid N+1 (batch), minimal client JS.
- **Verify before claiming done:** the workflow all session has been *build the feature → test it (browser via puppeteer / curl) → clean up test data → report*. Keep doing this.

---

## What's built (8 phases, all ✅ A+)

| Phase | Area | Delivered |
|---|---|---|
| 1 | SEO | Metadata + `generateMetadata`, OpenGraph (+generated OG image via `next/og`), JSON-LD (Product/Offer/AggregateRating/Breadcrumb/Org/WebSite), `sitemap.ts`, `robots.ts`, canonical |
| 2 | Privacy/consent | Cookie banner gating Pixel+CAPI (Meta Consent Mode, client **and** server), policy pages (`lib/legal` registry → static routes), footer |
| 3 | Trust | `lib/reviews` (ratings + moderation + verified-purchase), rich-snippet JSON-LD, catalog stars, About/Contact |
| 4 | Conversion | Guest checkout, `lib/discounts` + `lib/checkout` pricing engine, shipping methods + tax, free-ship progress bar, order notes, admin discounts |
| 5 | Retention | `lib/email` (pluggable provider + outbox), newsletter, welcome/order/abandoned-cart emails, `lib/abandoned`, admin retention panel |
| 6 | Performance | `next/image` everywhere (fill+sizes+priority), modern formats, mobile fixes |
| 7 | Catalog/Admin/Security | Facets+pagination+breadcrumbs+recently-viewed; admin best-sellers + gallery reorder; `lib/security` rate-limit + brute-force lockout + CSRF origin check |
| 8 | Visual/Meta final | Dark mode (`[data-theme]` + pre-paint script + `ThemeToggle`), Meta `Search` event, feed `mpn`/`identifier_exists` |

Detailed module map + schema + flows are in `README.md`.

---

## Gotchas & decisions learned this session (don't relearn the hard way)

1. **Next.js 16 specifics** — `params`/`cookies()` are async; use `generateMetadata`; metadata file conventions (`sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `icon.svg`). `AGENTS.md` says read `node_modules/next/dist/docs/` before assuming older APIs.
2. **Root dynamic `[slug]` is greedy** — a root-level `app/(group)/[slug]` route shadowed *every* non-root path (products/admin all 404'd). **Fixed** by using explicit static policy pages (`app/privacy/page.tsx`, etc.). Don't reintroduce a root catch-all. **Always re-test a route matrix after adding a dynamic segment.**
3. **Layout reads the session cookie** (`validateSession()` for the navbar) → all pages render dynamically. Fine with in-process SQLite. To add ISR later you must decouple the navbar session (client fetch) or accept dynamic.
4. **better-sqlite3 ≠ Vercel serverless** — needs a persistent FS. Deploy on a VM/container OR migrate to Postgres. DB file: `data/ecommerce.db` (gitignored, self-seeds).
5. **Dev-server restart race** — killing + immediately relaunching `next dev` in the background sometimes fails with an empty log. Just wait ~2s and relaunch once; it starts fine.
6. **Rate-limit pollution during testing** — hammering `/api/auth/login` consumes the per-IP limit; later browser logins from the same IP get 429. Use a fresh `X-Forwarded-For` header in curl tests, or wait out the window.
7. **CSS foot-guns fixed:** `.input-field` now has `width:100%`; admin `.label` class was missing (added). The home carousel text uses **fixed** (theme-independent) colors because it sits on a light hero image — don't switch it to theme vars or it vanishes in dark mode.
8. **Meta event dedup** — `fbTrackWithCapi` fires browser Pixel + server CAPI with one shared `event_id`; Purchase is server-authoritative (checkout API) and the browser fires the same id. Keep `content_ids` = product SKU.
9. **Auth redirects use full navigation** (`window.location.assign`) after login/logout so the server layout re-reads the cookie.

---

## Known limitations / not-yet-production

- ⚠️ **Payments are MOCKED** — the checkout card form is fake; no Stripe. This is the #1 launch blocker.
- **No automated test suite / CI** in the repo (all QA was manual via puppeteer/curl during the build).
- **SQLite** — single-instance only; migrate to Postgres for scale/serverless.
- **In-memory rate limiter** — use Redis for multi-instance.
- Email needs `RESEND_API_KEY`; Meta features need real IDs/tokens (+ a Meta App for one-click connect).
- Flat/zero tax, single admin role (no 2FA/audit log), no i18n/multi-currency, no shipping-carrier integration.
- Some legacy `any` types remain from the original create-next-app scaffold.

---

## Recommended next steps (highest ROI first)

1. **Stripe payments** — replace the mock card form with Stripe Checkout/Elements; create the order in a webhook (`/api/webhooks/stripe`) reusing the existing checkout transaction logic. Removes the launch blocker.
2. **Automated tests + CI** — unit-test pure modules (`computePricing`, `validateDiscount`, `getReviewSummary`) against a temp SQLite file; Playwright for checkout/review flows; GitHub Actions (lint + build + test).
3. **Postgres migration** — swap the `src/lib/db` client + port `init.ts` to migrations; unblocks serverless + ISR.
4. Connect real email/Meta accounts; add real product catalog.
5. Deploy live (VM or Postgres+Vercel) with a domain; set `NEXT_PUBLIC_SITE_URL`.
6. Then: sale/compare-at pricing, wishlist, product variants, order fulfillment/tracking.

---

## Valuation (honest, as of handoff)

- **As engineering / build cost:** ~$10k–$18k (freelance) / $25k–$50k (agency).
- **As a sellable asset today:** ~$3k–$6k (discounted by mocked payments + no tests/traffic).
- **As a live business:** $0 until it's trading (a store ≈ 2.5–4× annual net profit).
- Biggest single lever to raise value: **real payments + tests**.

---

## Git / repo status

- Remote `origin` = https://github.com/MRajibH/Ecomerce-special.git, branch `main`.
- `.gitignore` excludes: `/data/` (SQLite), `.env*` (except `.env.example`), `node_modules`, `.next`, `/public/images/avatars/` (runtime uploads). Demo product images ARE committed.
- Latest commit before this handoff: the full 8-phase platform (146 files).
- Author identity used: `MRajibH <web.team@brotecs.com>`.

*Everything above reflects the state at handoff. Trust the code + `README.md` over this doc if they diverge, and update this file as the project evolves.*
