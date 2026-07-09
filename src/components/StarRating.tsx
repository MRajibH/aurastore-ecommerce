import styles from './StarRating.module.css';

interface StarRatingProps {
  value: number;      // 0–5, may be fractional
  size?: number;      // px
  className?: string;
}

/** Read-only star display with fractional fill (e.g. 4.3 shows 86% of stars). */
export default function StarRating({ value, size = 16, className }: StarRatingProps) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={`${styles.stars} ${className ?? ''}`}
      style={{ fontSize: `${size}px` }}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      <span className={styles.back}>★★★★★</span>
      <span className={styles.front} style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}
