import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export async function POST(request: Request) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = passwordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { currentPassword, newPassword } = result.data;

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(session.user.id) as
      | { password_hash: string }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const valid = await verifyPassword(currentPassword, row.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, session.user.id);

    // Security: invalidate all OTHER sessions for this user after a password
    // change. The current session is preserved via its cookie token below.
    const currentToken = request.headers.get('cookie')?.match(/secure_session_token=([^;]+)/)?.[1];
    if (currentToken) {
      const { createHash } = await import('crypto');
      const hashedCurrent = createHash('sha256').update(currentToken).digest('hex');
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(session.user.id, hashedCurrent);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
