import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { adjustInventory, InventoryError } from '@/lib/inventory';

const bodySchema = z.object({
  action: z.enum(['release', 'hold', 'add']),
  quantity: z.number().int().positive(),
});

interface ParamsProps {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: ParamsProps) {
  try {
    const session = await validateSession();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    try {
      const counts = adjustInventory(id, parsed.data.action, parsed.data.quantity);
      return NextResponse.json({ success: true, inventory: counts });
    } catch (e) {
      if (e instanceof InventoryError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  } catch (error) {
    console.error('Inventory adjust error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
