import { NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import { createReview, createReviewSchema, userAlreadyReviewed } from '@/lib/reviews';
import { enforceRateLimit } from '@/lib/security/rate-limit';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, 'review', 10, 60_000);
    if (limited) return limited;

    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to write a review.' }, { status: 401 });
    }

    const { id } = await params;
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = createReviewSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    if (userAlreadyReviewed(session.user.id, id)) {
      return NextResponse.json({ error: 'You have already reviewed this product.' }, { status: 409 });
    }

    createReview({
      productId: id,
      userId: session.user.id,
      authorName: session.user.name,
      input: result.data,
    });

    // Reviews are held for moderation before appearing publicly.
    return NextResponse.json({ success: true, status: 'pending' });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
