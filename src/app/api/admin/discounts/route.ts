import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { createDiscount, createDiscountSchema } from '@/lib/discounts';

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = createDiscountSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const created = createDiscount(result.data);
  if (!created.ok) {
    return NextResponse.json({ error: created.reason }, { status: 409 });
  }
  return NextResponse.json({ success: true, id: created.id });
}
