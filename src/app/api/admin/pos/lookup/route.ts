import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { lookupProducts } from '@/lib/pos';

/** Product search/scan for the POS register. Admin-only. */
export async function GET(request: Request) {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get('q') ?? '';
  const products = lookupProducts(q);
  return NextResponse.json({ products });
}
