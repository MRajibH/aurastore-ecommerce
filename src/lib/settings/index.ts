import db from '@/lib/db/client';

/**
 * Generic global key/value store for site-wide settings that aren't tied to a
 * specific feature table (e.g. the active storefront theme). Backed by the
 * `site_settings` table. Kept deliberately small and typed at the call site so
 * higher-level modules (e.g. `lib/theme`) can build strongly-typed accessors on
 * top of it. This is a natural per-tenant seam for a future SaaS migration.
 */

interface SettingRow {
  value: string;
}

/** Read a setting by key, returning `fallback` when it is unset. */
export function getSetting(key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as SettingRow | undefined;
  return row?.value ?? fallback;
}

/** Upsert a setting value. */
export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, Date.now());
}
