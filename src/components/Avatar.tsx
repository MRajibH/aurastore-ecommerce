"use client";
import React, { useState } from 'react';
import Image from 'next/image';

/** Derive up-to-`max` uppercase initials from a display name ("Store Admin" → "SA"). */
export function getInitials(name: string, max = 2): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, max)
    .join('')
    .toUpperCase();
}

interface AvatarProps {
  /** Image URL, or null/empty to render initials directly. */
  src: string | null | undefined;
  /** Display name — used for the initials fallback and alt text. */
  name: string;
  /** `next/image` responsive sizes hint (the wrapper controls actual dimensions). */
  sizes: string;
  /** Max initials to show in the fallback (1 for compact badges, 2 for profile). */
  maxInitials?: number;
  /** Optional class applied to the initials fallback span. */
  initialsClassName?: string;
}

/**
 * Renders a user's avatar image with a resilient fallback: if `src` is absent
 * OR the image fails to load (e.g. the uploaded file was removed on disk), it
 * degrades gracefully to the user's initials instead of a broken-image icon.
 *
 * Renders only the inner content (image or initials) so each call site keeps
 * its own positioned wrapper (badge span, editable button, etc.). The wrapper
 * must be `position: relative` for the `fill` image to size correctly.
 */
export default function Avatar({ src, name, sizes, maxInitials = 2, initialsClassName }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Reset the error state when the source changes (e.g. after a new upload),
  // adjusting state during render rather than in an effect to avoid a cascading
  // re-render. See https://react.dev/learn/you-might-not-need-an-effect
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt={name}
        fill
        sizes={sizes}
        style={{ objectFit: 'cover' }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = getInitials(name, maxInitials);
  return initialsClassName ? <span className={initialsClassName}>{initials}</span> : <>{initials}</>;
}
