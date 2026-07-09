import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import { sendCapiEvent, extractUserDataFromRequest } from '@/lib/meta/capi';
import { hasConsent } from '@/lib/consent';
import { cartItemsSchema } from '@/lib/checkout/cart';
import { computePricing } from '@/lib/checkout/pricing';
import { validateDiscount, incrementDiscountUsage } from '@/lib/discounts';
import { sendEmail, orderConfirmationEmail } from '@/lib/email';
import { markRecoveredByEmail } from '@/lib/abandoned';
import crypto from 'crypto';

const checkoutSchema = z.object({
  shippingAddress: z.string().min(10, 'Address must be at least 10 characters'),
  cartItems: cartItemsSchema,
  shippingMethod: z.string().optional(),
  discountCode: z.string().trim().optional(),
  notes: z.string().max(1000).optional(),
  // Guest checkout fields (required only when unauthenticated)
  email: z.string().email().optional(),
  name: z.string().trim().min(2).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await validateSession();

    const body = await request.json();
    const result = checkoutSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const { shippingAddress, cartItems, shippingMethod, discountCode, notes, email, name } = result.data;

    // Identity: authenticated user OR guest (email + name required).
    const guestEmail = session ? null : (email ?? null);
    const guestName = session ? null : (name ?? null);
    if (!session && (!guestEmail || !guestName)) {
      return NextResponse.json({ error: 'Please provide your name and email to check out as a guest.' }, { status: 400 });
    }

    let orderId = '';
    let breakdown: ReturnType<typeof computePricing> | null = null;
    const purchasedContentIds: string[] = [];
    let emailItems: { name: string; quantity: number; price: number }[] = [];

    const transaction = db.transaction(() => {
      // 1. Resolve products from the DB (authoritative price + stock) and decrement stock.
      const lineItems: { productId: string; name: string; price: number; quantity: number }[] = [];
      for (const item of cartItems) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId) as
          | { id: string; name: string; price: number; stock: number }
          | undefined;
        if (!product) throw new Error('A product in your cart is no longer available.');
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock} left.`);
        }
        lineItems.push({ productId: product.id, name: product.name, price: product.price, quantity: item.quantity });
        purchasedContentIds.push(product.id);
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, product.id);
      }

      // 2. Validate the discount (against the true subtotal) and compute pricing.
      const subtotal = lineItems.reduce((s, i) => s + i.price * i.quantity, 0);
      let discount = null;
      if (discountCode) {
        const validation = validateDiscount(discountCode, subtotal);
        if (!validation.ok) throw new Error(validation.reason);
        discount = validation.discount;
      }
      breakdown = computePricing({ items: lineItems, discount, shippingMethodId: shippingMethod ?? 'standard' });
      emailItems = lineItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price }));

      // 3. Create the order with the full breakdown.
      orderId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO orders (
          id, user_id, guest_email, guest_name, subtotal, discount_code, discount_amount,
          shipping_amount, tax_amount, total_amount, status, shipping_address, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
      `).run(
        orderId,
        session?.user.id ?? null,
        guestEmail,
        guestName,
        breakdown.subtotal,
        breakdown.discountCode,
        breakdown.discount,
        breakdown.shipping,
        breakdown.tax,
        breakdown.total,
        shippingAddress,
        notes?.trim() || null,
        Date.now(),
      );

      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of lineItems) {
        insertItemStmt.run(crypto.randomUUID(), orderId, item.productId, item.quantity, item.price);
      }

      // 4. Record discount usage.
      if (discount) incrementDiscountUsage(discount.id);
    });

    try {
      transaction();
    } catch (txError) {
      const message = txError instanceof Error ? txError.message : 'Checkout failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 5. Lifecycle: send the order confirmation and clear any abandoned-cart
    //    record for this shopper (fire-and-forget — never blocks the response).
    const recipient = session?.user.email ?? guestEmail;
    if (recipient) {
      markRecoveredByEmail(recipient);
      sendEmail(
        orderConfirmationEmail({
          to: recipient,
          orderId,
          items: emailItems,
          subtotal: breakdown!.subtotal,
          discount: breakdown!.discount,
          shipping: breakdown!.shipping,
          tax: breakdown!.tax,
          total: breakdown!.total,
          shippingAddress,
        }),
      ).catch((e) => console.error('Order email failed:', e));
    }

    // 6. Server-side Purchase conversion (consent-gated), with a shared event_id.
    const purchaseEventId = crypto.randomUUID();
    const purchaseData = {
      content_ids: purchasedContentIds,
      content_type: 'product',
      num_items: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      value: breakdown!.total,
      currency: 'USD',
      order_id: orderId,
    };

    if (hasConsent(request)) {
      sendCapiEvent({
        eventName: 'Purchase',
        eventId: purchaseEventId,
        eventSourceUrl: request.headers.get('referer') || undefined,
        userData: extractUserDataFromRequest(request, {
          email: session?.user.email ?? guestEmail,
          externalId: session?.user.id ?? null,
        }),
        customData: purchaseData,
      }).catch((e) => console.error('Purchase CAPI failed:', e));
    }

    return NextResponse.json({
      success: true,
      orderId,
      breakdown,
      purchase: { eventId: purchaseEventId, ...purchaseData },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
