import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(request: NextRequest) {
  // 0. CSRF defense-in-depth: reject cross-site state-changing API requests.
  //    Browsers always send Origin on non-GET fetches, so a mismatch means the
  //    request came from another site. (Cookies are already SameSite=strict.)
  if (request.nextUrl.pathname.startsWith('/api') && MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      const originHost = (() => {
        try { return new URL(origin).host; } catch { return null; }
      })();
      if (originHost && originHost !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
      }
    }
  }

  const response = NextResponse.next();

  // 1. Clickjacking Protection
  response.headers.set('X-Frame-Options', 'DENY');

  // 2. MIME Sniffing Protection
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 3. Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 4. Strict Content Security Policy (CSP)
  // Allows loading assets, scripts, styles, and fonts only from trusted sources
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net; " + // unsafe-inline allowed for Next.js hydration, unsafe-eval for dev server hot reload; connect.facebook.net for the Meta Pixel
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " + // https: covers the Meta Pixel tracking image (facebook.com/tr)
    "media-src 'self' https: blob:; " + // product videos: self-hosted uploads + pasted https: URLs
    "connect-src 'self' https://connect.facebook.net https://www.facebook.com https://graph.facebook.com; " + // Pixel + FB JS SDK graph calls
    "frame-src 'self' https://www.facebook.com;" // Facebook Login for Business dialog
  );

  // 5. Feature Control (Permissions-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()'
  );

  // 6. HSTS (Strict-Transport-Security) for HTTPS enforcement
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public product images)
     */
    '/((?!_next/static|_next/image|favicon.ico|images).*)',
  ],
};
