import { NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { getMetaSettings } from '@/lib/meta/settings';

// Always render fresh so Meta's scheduled fetch sees current stock/pricing.
export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category: string;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Resolve the absolute site origin from settings, falling back to the request. */
function resolveOrigin(request: Request, settingsSiteUrl: string | null): string {
  if (settingsSiteUrl) return settingsSiteUrl.replace(/\/$/, '');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const settings = getMetaSettings();

  // Optional shared-secret guard: if META_FEED_TOKEN is set, require ?token=.
  const feedToken = process.env.META_FEED_TOKEN;
  if (feedToken) {
    const token = new URL(request.url).searchParams.get('token');
    if (token !== feedToken) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const origin = resolveOrigin(request, settings.siteUrl);
  const products = db
    .prepare('SELECT id, name, description, price, stock, image_url, category FROM products ORDER BY created_at DESC')
    .all() as ProductRow[];

  // Additional gallery images, grouped by product for <g:additional_image_link>.
  const extraImages = db
    .prepare('SELECT product_id, url FROM product_images ORDER BY sort_order ASC')
    .all() as { product_id: string; url: string }[];
  const galleryByProduct = extraImages.reduce<Record<string, string[]>>((acc, row) => {
    (acc[row.product_id] ||= []).push(row.url);
    return acc;
  }, {});

  const toAbsolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${origin}${url}`);

  const items = products
    .map((p) => {
      // Meta requires the exact strings: "in stock" | "out of stock" | "preorder"
      const availability = p.stock > 0 ? 'in stock' : 'out of stock';
      const imageLink = toAbsolute(p.image_url);
      const link = `${origin}/products/${p.id}`;
      // Price must be "<amount> <ISO currency>", e.g. "29.99 USD"
      const price = `${p.price.toFixed(2)} USD`;

      // Up to 10 additional images (Meta/Google limit), excluding the primary.
      const additional = (galleryByProduct[p.id] || [])
        .map(toAbsolute)
        .filter((u) => u !== imageLink)
        .slice(0, 10)
        .map((u) => `\n      <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`)
        .join('');

      return `    <item>
      <g:id>${xmlEscape(p.id)}</g:id>
      <g:title>${xmlEscape(p.name)}</g:title>
      <g:description>${xmlEscape(p.description)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(imageLink)}</g:image_link>${additional}
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${xmlEscape(price)}</g:price>
      <g:brand>${xmlEscape(settings.brandName)}</g:brand>
      <g:mpn>${xmlEscape(p.id)}</g:mpn>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xmlEscape(p.category)}</g:product_type>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(settings.brandName)} Product Catalog</title>
    <link>${xmlEscape(origin)}</link>
    <description>Product data feed for Meta Catalog scheduled sync</description>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Meta pulls hourly/daily; allow short caching by intermediaries.
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
