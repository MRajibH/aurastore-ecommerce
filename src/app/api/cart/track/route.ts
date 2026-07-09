import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { cartItemsSchema, resolveLineItems } from '@/lib/checkout/cart';
import { upsertAbandonedCart } from '@/lib/abandoned';

const schema = z.object({
  cartItems: cartItemsSchema,
  email: z.string().email().optional(),
  name: z.string().trim().max(100).optional(),
});

/**
 * Capture an in-progress cart for abandoned-cart recovery. Called from the
 * checkout page once we know the shopper's email (logged-in, or a guest who has
 * entered a valid email). Prices/names come from the DB, never the client.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const session = await validateSession();
    const email = session?.user.email ?? result.data.email;
    const name = session?.user.name ?? result.data.name ?? null;
    if (!email) {
      // No identity yet — nothing to recover to. Not an error.
      return NextResponse.json({ success: true, captured: false });
    }

    const items = resolveLineItems(result.data.cartItems);
    if (items.length === 0) return NextResponse.json({ success: true, captured: false });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    upsertAbandonedCart({
      email,
      name,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
      subtotal,
    });

    return NextResponse.json({ success: true, captured: true });
  } catch (error) {
    console.error('Cart track error:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
