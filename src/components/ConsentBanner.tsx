"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getConsent, setConsent } from '@/lib/consent';
import styles from './ConsentBanner.module.css';

/**
 * GDPR/CPRA cookie-consent banner. Shows until the visitor makes a choice.
 * The choice gates all Meta Pixel + Conversions API tracking (see fbpixel /
 * FacebookPixel / server routes).
 */
export default function ConsentBanner() {
  // Render nothing until mounted to avoid a hydration flash / SSR mismatch.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (value: 'granted' | 'denied') => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className={styles.inner}>
        <p className={styles.text}>
          We use cookies to power analytics and personalized advertising. You can accept or decline
          non-essential cookies. Read our{' '}
          <Link href="/cookies" className={styles.link}>Cookie Policy</Link> and{' '}
          <Link href="/privacy" className={styles.link}>Privacy Policy</Link>.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => choose('denied')}>
            Decline
          </button>
          <button type="button" className="btn btn-primary" onClick={() => choose('granted')}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
