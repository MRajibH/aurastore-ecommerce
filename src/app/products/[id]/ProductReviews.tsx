"use client";
import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRating from '@/components/StarRating';
import type { Review, ReviewSummary } from '@/lib/reviews/types';
import styles from './ProductReviews.module.css';

interface ProductReviewsProps {
  productId: string;
  summary: ReviewSummary;
  reviews: Review[];
  isLoggedIn: boolean;
  alreadyReviewed: boolean;
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function ProductReviews({ productId, summary, reviews, isLoggedIn, alreadyReviewed }: ProductReviewsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (rating < 1) {
      setMessage({ type: 'error', text: 'Please select a star rating.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title: title || undefined, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Thanks! Your review was submitted and will appear once approved.' });
        setShowForm(false);
        setRating(0); setTitle(''); setBody('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not submit review.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to server.' });
    } finally {
      setSubmitting(false);
    }
  };

  const maxBar = Math.max(1, ...Object.values(summary.distribution));

  return (
    <section className={styles.section} id="reviews">
      <h2 className={styles.sectionTitle}>Customer Reviews</h2>

      <div className={styles.overview}>
        {/* Aggregate score */}
        <div className={styles.scoreBox}>
          <div className={styles.scoreNumber}>{summary.count > 0 ? summary.average.toFixed(1) : '—'}</div>
          <StarRating value={summary.average} size={20} />
          <div className={styles.scoreCount}>
            {summary.count > 0 ? `${summary.count} review${summary.count === 1 ? '' : 's'}` : 'No reviews yet'}
          </div>
        </div>

        {/* Distribution bars */}
        {summary.count > 0 && (
          <div className={styles.distribution}>
            {[5, 4, 3, 2, 1].map((star) => {
              const c = summary.distribution[star] ?? 0;
              return (
                <div key={star} className={styles.distRow}>
                  <span className={styles.distLabel}>{star}★</span>
                  <span className={styles.distTrack}>
                    <span className={styles.distFill} style={{ width: `${(c / maxBar) * 100}%` }} />
                  </span>
                  <span className={styles.distCount}>{c}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Write review CTA */}
        <div className={styles.ctaBox}>
          {isLoggedIn ? (
            alreadyReviewed ? (
              <p className={styles.note}>You&apos;ve already reviewed this product.</p>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
                {showForm ? 'Cancel' : 'Write a Review'}
              </button>
            )
          ) : (
            <p className={styles.note}>
              <Link href={`/login?redirectTo=/products/${productId}`} className={styles.link}>Sign in</Link> to write a review.
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.successAlert : styles.errorAlert}>{message.text}</div>
      )}

      {/* Review form */}
      {showForm && !alreadyReviewed && (
        <form className={`${styles.form} glass-card`} onSubmit={handleSubmit}>
          <div className={styles.ratingInput} role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={styles.starBtn}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
                aria-checked={rating === star}
                role="radio"
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                style={{ color: (hover || rating) >= star ? '#f5a623' : '#d4d4d8' }}
              >
                ★
              </button>
            ))}
            <span className={styles.ratingLabel}>{RATING_LABELS[hover || rating]}</span>
          </div>

          <div className="form-group">
            <label htmlFor="review-title">Title (optional)</label>
            <input id="review-title" className="input-field" value={title} maxLength={120}
              onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
          </div>

          <div className="form-group">
            <label htmlFor="review-body">Your review</label>
            <textarea id="review-body" className="input-field" value={body} required minLength={10} maxLength={2000} rows={4}
              onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike?" style={{ resize: 'vertical' }} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      )}

      {/* Review list */}
      <div className={styles.list}>
        {reviews.length === 0 ? (
          <p className={styles.empty}>Be the first to review this product.</p>
        ) : (
          reviews.map((r) => (
            <article key={r.id} className={styles.review}>
              <div className={styles.reviewHead}>
                <StarRating value={r.rating} size={15} />
                {r.title && <span className={styles.reviewTitle}>{r.title}</span>}
              </div>
              <div className={styles.reviewMeta}>
                <span className={styles.author}>{r.authorName}</span>
                {r.verified && <span className={styles.verified}>✓ Verified Purchase</span>}
                <span className={styles.date}>{new Date(r.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <p className={styles.reviewBody}>{r.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
