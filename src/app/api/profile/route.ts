import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
});

export async function PATCH(request: Request) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = profileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, email, phone, bio, address } = result.data;

    // If the email changed, ensure it isn't taken by another account.
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== session.user.email.toLowerCase()) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, session.user.id);
      if (existing) {
        return NextResponse.json({ error: 'That email address is already in use.' }, { status: 409 });
      }
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone = ?, bio = ?, address = ?
      WHERE id = ?
    `).run(name, normalizedEmail, phone || null, bio || null, address || null, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
