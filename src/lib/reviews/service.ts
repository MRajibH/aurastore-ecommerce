import crypto from 'crypto';
import db from '@/lib/db/client';
import type { CreateReviewInput, Review, ReviewStatus, ReviewSummary } from './types';
import { EMPTY_SUMMARY } from './types';

interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  verified: number;
  created_at: number;
}

function mapRow(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status as ReviewStatus,
    verified: row.verified === 1,
    createdAt: row.created_at,
  };
}

/** Approved reviews for a product, newest first. */
export function getApprovedReviews(productId: string): Review[] {
  const rows = db
    .prepare("SELECT * FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC")
    .all(productId) as ReviewRow[];
  return rows.map(mapRow);
}

/** Aggregate rating summary (count, average, star distribution) from approved reviews. */
export function getReviewSummary(productId: string): ReviewSummary {
  const rows = db
    .prepare("SELECT rating FROM reviews WHERE product_id = ? AND status = 'approved'")
    .all(productId) as { rating: number }[];
  if (rows.length === 0) return { ...EMPTY_SUMMARY, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const { rating } of rows) {
    distribution[rating] = (distribution[rating] ?? 0) + 1;
    total += rating;
  }
  return {
    count: rows.length,
    average: Math.round((total / rows.length) * 10) / 10,
    distribution,
  };
}

/**
 * Batch summaries (count + average) for many products at once — avoids N+1 on
 * the catalog grid. Distribution is omitted (zeroed) for performance.
 */
export function getSummariesForProducts(productIds: string[]): Map<string, ReviewSummary> {
  const result = new Map<string, ReviewSummary>();
  if (productIds.length === 0) return result;

  const placeholders = productIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT product_id, COUNT(*) as count, AVG(rating) as avg
       FROM reviews WHERE status = 'approved' AND product_id IN (${placeholders})
       GROUP BY product_id`,
    )
    .all(...productIds) as { product_id: string; count: number; avg: number }[];

  for (const row of rows) {
    result.set(row.product_id, {
      count: row.count,
      average: Math.round(row.avg * 10) / 10,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  }
  return result;
}

/** Has the user ever ordered this product? Drives the "verified purchase" badge. */
export function hasPurchased(userId: string, productId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? LIMIT 1`,
    )
    .get(userId, productId);
  return !!row;
}

export function userAlreadyReviewed(userId: string, productId: string): boolean {
  const row = db.prepare('SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1').get(userId, productId);
  return !!row;
}

/**
 * Create a pending review. `verified` is derived from the user's order history.
 * Returns the new review id.
 */
export function createReview(params: {
  productId: string;
  userId: string;
  authorName: string;
  input: CreateReviewInput;
}): string {
  const { productId, userId, authorName, input } = params;
  const id = crypto.randomUUID();
  const verified = hasPurchased(userId, productId) ? 1 : 0;

  db.prepare(
    `INSERT INTO reviews (id, product_id, user_id, author_name, rating, title, body, status, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(id, productId, userId, authorName, input.rating, input.title?.trim() || null, input.body.trim(), verified, Date.now());

  return id;
}

// ---- Admin moderation ----

export function listReviews(status?: ReviewStatus): (Review & { productName: string | null })[] {
  const base = `
    SELECT r.*, p.name as product_name
    FROM reviews r LEFT JOIN products p ON p.id = r.product_id
  `;
  const rows = (
    status
      ? db.prepare(`${base} WHERE r.status = ? ORDER BY r.created_at DESC`).all(status)
      : db.prepare(`${base} ORDER BY r.created_at DESC`).all()
  ) as (ReviewRow & { product_name: string | null })[];
  return rows.map((r) => ({ ...mapRow(r), productName: r.product_name }));
}

export function setReviewStatus(id: string, status: ReviewStatus): boolean {
  return db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id).changes > 0;
}

export function deleteReview(id: string): boolean {
  return db.prepare('DELETE FROM reviews WHERE id = ?').run(id).changes > 0;
}
