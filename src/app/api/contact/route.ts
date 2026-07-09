import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import db from '@/lib/db/client';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().email('Please enter a valid email'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, 'contact', 5, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const result = contactSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, email, message } = result.data;
    db.prepare(
      'INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), name, email, message, Date.now());

    // (Phase 5 will also email the team; for now the message is stored for review.)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
