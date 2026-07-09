import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getAbandonedCart } from '@/lib/abandoned';
import { sendEmail, abandonedCartEmail } from '@/lib/email';

interface Params {
  params: Promise<{ id: string }>;
}

/** Admin action: send a recovery email for an abandoned cart. */
export async function POST(_request: Request, { params }: Params) {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const cart = getAbandonedCart(id);
  if (!cart) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await sendEmail(
    abandonedCartEmail({
      to: cart.email,
      name: cart.name,
      items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    }),
  );

  return NextResponse.json({ success: true });
}
