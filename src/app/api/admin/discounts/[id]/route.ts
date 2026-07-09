import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { setDiscountActive, deleteDiscount } from '@/lib/discounts';

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({ active: z.boolean() });

async function requireAdmin() {
  const session = await validateSession();
  return session && session.user.role === 'admin' ? session : null;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }
  if (!setDiscountActive(id, result.data.active)) {
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!deleteDiscount(id)) {
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
