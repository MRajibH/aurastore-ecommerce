import type { MetadataRoute } from 'next';
import db from '@/lib/db/client';
import { SITE_URL } from '@/lib/site';
import { LEGAL_DOCS } from '@/lib/legal/content';

// Regenerate so newly added products appear in the sitemap.
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const products = db
    .prepare('SELECT id, created_at FROM products ORDER BY created_at DESC')
    .all() as { id: string; created_at: number }[];

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const legalRoutes: MetadataRoute.Sitemap = Object.values(LEGAL_DOCS).map((doc) => ({
    url: `${SITE_URL}/${doc.slug}`,
    lastModified: new Date(doc.updated),
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...legalRoutes, ...productRoutes];
}
