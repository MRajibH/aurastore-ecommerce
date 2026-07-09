import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';

const statusSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']),
});

interface ParamsProps {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: ParamsProps) {
  try {
    // 1. Verify administrator credentials
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Validate status options
    const body = await request.json();
    const result = statusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { status } = result.data;

    // 3. Execute update safely with parameter bindings
    const updateResult = db.prepare(`
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    if (updateResult.changes === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
