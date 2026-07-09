import { z } from 'zod';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  productId: string;
  userId: string | null;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  verified: boolean;
  createdAt: number;
}

export interface ReviewSummary {
  count: number;
  /** Mean rating rounded to one decimal (0 when no approved reviews). */
  average: number;
  /** Count of approved reviews per star value (1–5). */
  distribution: Record<number, number>;
}

/** Validation for a customer-submitted review (the boundary contract). */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, 'Review must be at least 10 characters').max(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const EMPTY_SUMMARY: ReviewSummary = {
  count: 0,
  average: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};
