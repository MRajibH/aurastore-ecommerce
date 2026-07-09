"use client";
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { FB_PIXEL_ID } from '@/lib/fbpixel';
import { getConsent } from '@/lib/consent';

/**
 * Loads the Meta Pixel with Consent Mode: tracking is REVOKED by default and
 * only granted once the visitor accepts cookies (via ConsentBanner). Re-fires
 * PageView on client navigations. Renders nothing when no Pixel ID is set.
 */
export default function FacebookPixel() {
  const pathname = usePathname();
  const initialLoad = useRef(true);

  // Grant consent + fire the first PageView when the user accepts (or on load
  // if they already accepted in a previous session).
  useEffect(() => {
    if (!FB_PIXEL_ID) return;

    const grantIfConsented = () => {
      if (getConsent() === 'granted' && typeof window.fbq === 'function') {
        window.fbq('consent', 'grant');
        window.fbq('track', 'PageView');
      }
    };

    grantIfConsented();
    window.addEventListener('aura-consent-changed', grantIfConsented);
    return () => window.removeEventListener('aura-consent-changed', grantIfConsented);
  }, []);

  // Track PageView on SPA route changes (only meaningful once consent granted;
  // with consent revoked the Pixel buffers/suppresses these calls).
  useEffect(() => {
    if (!FB_PIXEL_ID) return;
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    if (getConsent() === 'granted' && typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [pathname]);

  if (!FB_PIXEL_ID) return null;

  return (
    <Script id="facebook-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('consent', 'revoke');
        fbq('init', '${FB_PIXEL_ID}');
      `}
    </Script>
  );
}
