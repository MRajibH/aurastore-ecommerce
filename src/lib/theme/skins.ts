/**
 * Client-safe skin registry and types. This file intentionally has NO database
 * or server-only imports so it can be imported from client components (e.g. the
 * admin theme picker). Server-only accessors live in `./index.ts`.
 *
 * A storefront "skin" is the global design language the whole store wears —
 * independent of light/dark mode (a per-visitor preference applied via
 * `data-theme`). The active skin is applied to `<html data-skin=…>`.
 */
export type ThemeSkin = 'classic' | 'editorial';

export const DEFAULT_SKIN: ThemeSkin = 'classic';

export interface SkinMeta {
  id: ThemeSkin;
  name: string;
  tagline: string;
  description: string;
}

/** Registry of selectable skins (drives the admin picker and validation). */
export const SKINS: readonly SkinMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Vibrant · techy',
    description: 'Electric-indigo brand gradients and glassmorphic cards. Bold and modern.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Minimal · premium',
    description: 'Warm neutral palette, a single flat accent, and calm image-forward cards. Boutique feel.',
  },
] as const;

export function isThemeSkin(value: unknown): value is ThemeSkin {
  return typeof value === 'string' && SKINS.some((s) => s.id === value);
}
