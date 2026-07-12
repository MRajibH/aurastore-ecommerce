import db from '@/lib/db/client';

/**
 * Inventory hold-back model. A product's physical on-hand stock is split into:
 *   - `stock`          → Available: released & sellable (catalog, checkout, POS)
 *   - `reserved_stock` → Reserved: held back by the admin, not sellable
 * Total on-hand = stock + reserved_stock.
 *
 * Selling only ever decrements `stock` (handled by checkout/POS). These helpers
 * move units between the two buckets, or add new arrivals — always atomically
 * and guarded so neither bucket can go negative.
 */

export type InventoryAction = 'release' | 'hold' | 'add';

export interface InventoryCounts {
  available: number;
  reserved: number;
  total: number;
}

interface ProductStockRow {
  stock: number;
  reserved_stock: number;
}

export class InventoryError extends Error {}

function counts(row: ProductStockRow): InventoryCounts {
  return { available: row.stock, reserved: row.reserved_stock, total: row.stock + row.reserved_stock };
}

/** Current Available / Reserved / Total for a product. */
export function getInventory(productId: string): InventoryCounts | null {
  const row = db.prepare('SELECT stock, reserved_stock FROM products WHERE id = ?').get(productId) as
    | ProductStockRow
    | undefined;
  return row ? counts(row) : null;
}

/**
 * Apply an inventory movement atomically:
 *   - release: move `quantity` from Reserved → Available
 *   - hold:    move `quantity` from Available → Reserved
 *   - add:     add `quantity` new units to Available (new arrivals)
 * Throws InventoryError on a bad quantity or insufficient source bucket.
 */
export function adjustInventory(productId: string, action: InventoryAction, quantity: number): InventoryCounts {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InventoryError('Quantity must be a whole number of at least 1.');
  }

  const apply = db.transaction(() => {
    const row = db.prepare('SELECT stock, reserved_stock FROM products WHERE id = ?').get(productId) as
      | ProductStockRow
      | undefined;
    if (!row) throw new InventoryError('Product not found.');

    switch (action) {
      case 'release':
        if (row.reserved_stock < quantity) {
          throw new InventoryError(`Only ${row.reserved_stock} in reserve to release.`);
        }
        db.prepare('UPDATE products SET stock = stock + ?, reserved_stock = reserved_stock - ? WHERE id = ?')
          .run(quantity, quantity, productId);
        break;
      case 'hold':
        if (row.stock < quantity) {
          throw new InventoryError(`Only ${row.stock} available to hold back.`);
        }
        db.prepare('UPDATE products SET stock = stock - ?, reserved_stock = reserved_stock + ? WHERE id = ?')
          .run(quantity, quantity, productId);
        break;
      case 'add':
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, productId);
        break;
      default:
        throw new InventoryError('Unknown inventory action.');
    }

    const updated = db.prepare('SELECT stock, reserved_stock FROM products WHERE id = ?').get(productId) as ProductStockRow;
    return counts(updated);
  });

  return apply();
}
