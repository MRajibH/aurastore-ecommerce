import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { createPosSale } from '@/lib/pos';
import { sendEmail, orderConfirmationEmail } from '@/lib/email';

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'Add at least one item to the sale.'),
  discountCode: z.string().trim().max(64).optional().nullable(),
  paymentMethod: z.enum(['cash', 'card', 'other']),
  amountTendered: z.number().nonnegative().optional().nullable(),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerEmail: z.string().email().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await validateSession();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = saleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    let sale;
    try {
      sale = createPosSale(parsed.data, session.user.id);
    } catch (txError) {
      const message = txError instanceof Error ? txError.message : 'Sale failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Optional emailed receipt (fire-and-forget; never blocks the response).
    if (sale.customerEmail) {
      sendEmail(
        orderConfirmationEmail({
          to: sale.customerEmail,
          orderId: sale.orderId,
          items: sale.lines.map((l) => ({ name: l.name, quantity: l.quantity, price: l.price })),
          subtotal: sale.subtotal,
          discount: sale.discount,
          shipping: 0,
          tax: sale.tax,
          total: sale.total,
          shippingAddress: 'In-store purchase (POS)',
        }),
      ).catch((e) => console.error('POS receipt email failed:', e));
    }

    return NextResponse.json({ success: true, sale });
  } catch (error) {
    console.error('POS sale error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
