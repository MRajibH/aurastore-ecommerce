import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/hash';
import { createSession } from '@/lib/auth/session';
import { sendEmail, welcomeEmail } from '@/lib/email';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import crypto from 'crypto';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, 'signup', 5, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const result = signupSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }
    
    const { name, email, password } = result.data;
    
    // Check if email already exists using secure parameterized queries
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }
    
    // Create new user record
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'customer', ?)
    `).run(userId, name, email, passwordHash, Date.now());
    
    // Set authenticated session cookie
    await createSession(userId);

    // Fire-and-forget welcome email (never blocks signup).
    sendEmail(welcomeEmail(name, email)).catch((e) => console.error('Welcome email failed:', e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
