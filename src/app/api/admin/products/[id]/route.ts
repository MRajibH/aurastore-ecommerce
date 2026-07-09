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
  // Optional: only replaces the existing image when a new path is provided.
  image_url: z.string().min(1).optional(),
  // When provided, replaces the full set of additional gallery images.
  gallery: z.array(z.string().min(1)).max(10).optional(),
});

interface ParamsProps {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: ParamsProps) {
  try {
    // 1. Verify administrative privileges
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Validate input schema using Zod
    const body = await request.json();
    const result = productSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, description, price, stock, category, image_url, gallery } = result.data;

    // 3. Update product in database securely with parameter binding.
    //    COALESCE keeps the current image when no new image_url is supplied.
    const updateResult = db.prepare(`
      UPDATE products
      SET name = ?, description = ?, price = ?, stock = ?, category = ?,
          image_url = COALESCE(?, image_url)
      WHERE id = ?
    `).run(name, description, price, stock, category, image_url ?? null, id);

    if (updateResult.changes === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 4. When a gallery array is supplied, replace the product's extra images.
    if (gallery !== undefined) {
      const del = db.prepare('DELETE FROM product_images WHERE product_id = ?');
      const insertImage = db.prepare(`
        INSERT INTO product_images (id, product_id, url, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        del.run(id);
        gallery.forEach((url, i) => insertImage.run(crypto.randomUUID(), id, url, i + 1, Date.now()));
      })();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: ParamsProps) {
  try {
    // 1. Verify administrative privileges
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 2. Delete product safely with parameter binding
    const deleteResult = db.prepare('DELETE FROM products WHERE id = ?').run(id);

    if (deleteResult.changes === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
