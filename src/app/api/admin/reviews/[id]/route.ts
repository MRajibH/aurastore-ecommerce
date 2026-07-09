import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { setReviewStatus, deleteReview } from '@/lib/reviews';

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
});

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
  if (!setReviewStatus(id, result.data.status)) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!deleteReview(id)) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
