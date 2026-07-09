import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/hash';
import { createSession } from '@/lib/auth/session';
import { enforceRateLimit, rateLimit, resetRateLimit, getClientIp } from '@/lib/security/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: Request) {
  try {
    // Throttle login attempts per IP (mitigates credential stuffing).
    const ipLimited = enforceRateLimit(request, 'login-ip', 10, 60_000);
    if (ipLimited) return ipLimited;

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Brute-force lockout per account: 5 failed attempts / 15 min.
    const failKey = `login-fail:${getClientIp(request)}:${email.toLowerCase()}`;
    const lock = rateLimit(failKey, 5, 15 * 60_000);
    if (!lock.ok) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(lock.retryAfter) } },
      );
    }

    // Secure query with parameter binding to prevent SQLi
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      // Prevent user enumeration by returning a generic error
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      );
    }

    // Verify password using scrypt and timingSafeEqual
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      );
    }

    // Successful login: clear the failed-attempt counter and start a session.
    resetRateLimit(failKey);
    await createSession(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
