import db from '@/lib/db/client';

/**
 * Resolved Meta integration settings. Values are read from the meta_settings
 * table (populated via the marketing dashboard / Facebook connect flow) and
 * fall back to environment variables so the integration can also be configured
 * purely through env in CI or headless deployments.
 */
export interface MetaSettings {
  pixelId: string | null;          // Pixel / Dataset ID (used by browser Pixel + CAPI)
  capiAccessToken: string | null;  // System user / conversions API access token
  catalogId: string | null;        // Commerce catalog the feed is attached to
  pageId: string | null;
  businessId: string | null;
  brandName: string;               // <g:brand> in the catalog feed
  siteUrl: string | null;          // Absolute origin used to build feed links
  testEventCode: string | null;    // Optional Meta "Test Events" code
  connectedAt: number | null;
}

interface MetaSettingsRow {
  pixel_id: string | null;
  capi_access_token: string | null;
  catalog_id: string | null;
  page_id: string | null;
  business_id: string | null;
  brand_name: string | null;
  site_url: string | null;
  test_event_code: string | null;
  connected_at: number | null;
}

export function getMetaSettings(): MetaSettings {
  const row = (db.prepare("SELECT * FROM meta_settings WHERE id = 'default'").get() as MetaSettingsRow | undefined) ?? ({} as Partial<MetaSettingsRow>);

  return {
    pixelId: row.pixel_id || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || null,
    capiAccessToken: row.capi_access_token || process.env.META_CAPI_ACCESS_TOKEN || null,
    catalogId: row.catalog_id || process.env.META_CATALOG_ID || null,
    pageId: row.page_id || null,
    businessId: row.business_id || process.env.META_BUSINESS_ID || null,
    brandName: row.brand_name || process.env.META_BRAND_NAME || 'AURA Store',
    siteUrl: (row.site_url || process.env.NEXT_PUBLIC_SITE_URL || null)?.replace(/\/$/, '') || null,
    testEventCode: row.test_event_code || process.env.META_TEST_EVENT_CODE || null,
    connectedAt: row.connected_at ?? null,
  };
}

const COLUMN_MAP: Record<string, string> = {
  pixelId: 'pixel_id',
  capiAccessToken: 'capi_access_token',
  catalogId: 'catalog_id',
  pageId: 'page_id',
  businessId: 'business_id',
  brandName: 'brand_name',
  siteUrl: 'site_url',
  testEventCode: 'test_event_code',
  connectedAt: 'connected_at',
};

/**
 * Persist a partial update to the settings row. Only keys present in `patch`
 * are written; `undefined` values are ignored so callers can update a subset.
 */
export function updateMetaSettings(patch: Partial<Record<keyof typeof COLUMN_MAP, string | number | null>>): void {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    const value = patch[key as keyof typeof COLUMN_MAP];
    if (value !== undefined) {
      assignments.push(`${column} = ?`);
      values.push(value);
    }
  }

  if (assignments.length === 0) return;

  assignments.push('updated_at = ?');
  values.push(Date.now());

  db.prepare(`UPDATE meta_settings SET ${assignments.join(', ')} WHERE id = 'default'`).run(...values);
}
