// Central site metadata used across SEO surfaces (metadata, JSON-LD, sitemap,
// feed, OpenGraph). Override the origin with NEXT_PUBLIC_SITE_URL in production.

export const SITE_NAME = 'AURA Store';

export const SITE_TAGLINE = 'Premium E-Commerce';

export const SITE_DESCRIPTION =
  'Shop premium electronics, smart-living accessories, and modern essentials at AURA Store — curated quality, fast free shipping over $50, and a secure checkout.';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE_TWITTER = '@aurastore';

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
