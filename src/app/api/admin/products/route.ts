import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import crypto from 'crypto';

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be a positive number'),
  stock: z.number().int().nonnegative('Stock must be a non-negative integer'),
  category: z.string().min(2, 'Category must be selected'),
  // Relative path produced by the /api/admin/upload endpoint (or a manual path).
  image_url: z.string().min(1).optional(),
  // Additional gallery images shown on the product page (beyond the primary).
  gallery: z.array(z.string().min(1)).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate user and verify administrator role
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate input schema using Zod
    const body = await request.json();
    const result = productSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, description, price, stock, category, image_url, gallery } = result.data;
    const productId = crypto.randomUUID();
    const imageUrl = image_url || '/images/products/placeholder.svg';

    // 3. Create product + gallery atomically using parameter binding
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, description, price, stock, image_url, category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertImage = db.prepare(`
      INSERT INTO product_images (id, product_id, url, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
      insertProduct.run(productId, name, description, price, stock, imageUrl, category, Date.now());
      (gallery ?? []).forEach((url, i) => insertImage.run(crypto.randomUUID(), productId, url, i + 1, Date.now()));
    })();

    return NextResponse.json({ success: true, productId });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
