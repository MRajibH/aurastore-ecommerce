import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';

const roleSchema = z.object({
  role: z.enum(['admin', 'customer']),
});

interface ParamsProps {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: ParamsProps) {
  try {
    // 1. Verify administrative privileges
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Validate input schema using Zod
    const body = await request.json();
    const result = roleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { role } = result.data;

    // 3. Safety check: Prevent lockouts by blocking the demotion of the last remaining admin
    if (role === 'customer') {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
      if (user && user.role === 'admin') {
        const adminCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
        if (adminCountRow.count <= 1) {
          return NextResponse.json(
            { error: 'Security Block: Cannot demote the last remaining administrator account.' },
            { status: 400 }
          );
        }
      }
    }

    // 4. Update customer role using parameter binding
    const updateResult = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);

    if (updateResult.changes === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update user role error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: ParamsProps) {
  try {
    // 1. Verify administrative privileges
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Safety check: Prevent admins from deleting their own active profile
    if (id === sessionResult.user.id) {
      return NextResponse.json({ error: 'Security Block: Cannot delete your own active administrative account.' }, { status: 400 });
    }

    // 3. Delete user safely using parameter binding
    const deleteResult = db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (deleteResult.changes === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
