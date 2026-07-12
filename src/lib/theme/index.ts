import { getSetting, setSetting } from '@/lib/settings';
import { DEFAULT_SKIN, isThemeSkin, type ThemeSkin } from './skins';

// Re-export the client-safe registry/types so server callers can use a single
// import path. Client components must import from '@/lib/theme/skins' directly
// to avoid pulling the DB-backed accessors below into the browser bundle.
export * from './skins';

const SETTING_KEY = 'theme_skin';

/** The store's currently active skin (falls back to the default). */
export function getThemeSkin(): ThemeSkin {
  const value = getSetting(SETTING_KEY, DEFAULT_SKIN);
  return isThemeSkin(value) ? value : DEFAULT_SKIN;
}

/** Persist the active skin. Caller must validate authorization. */
export function setThemeSkin(skin: ThemeSkin): void {
  setSetting(SETTING_KEY, skin);
}
