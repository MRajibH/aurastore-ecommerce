import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Branded default OpenGraph/Twitter image used for pages without their own.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c5cf6 52%, #a855f7 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 132,
            height: 132,
            borderRadius: 32,
            background: 'rgba(255,255,255,0.14)',
            border: '4px solid rgba(255,255,255,0.6)',
            marginBottom: 40,
          }}
        >
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '10px solid #fff', display: 'flex' }} />
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: '-0.03em', display: 'flex' }}>
          AURA <span style={{ fontWeight: 300, marginLeft: 18 }}>STORE</span>
        </div>
        <div style={{ fontSize: 34, opacity: 0.9, marginTop: 16 }}>{SITE_TAGLINE}</div>
      </div>
    ),
    size,
  );
}
