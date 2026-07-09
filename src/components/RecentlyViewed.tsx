"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './RecentlyViewed.module.css';

export interface RecentProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

const KEY = 'aura_recently_viewed';
const MAX = 8;

function read(): RecentProduct[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Records the current product in localStorage and renders the shopper's other
 * recently-viewed products. Purely client-side (privacy-friendly, no tracking).
 */
export default function RecentlyViewed({ current }: { current: RecentProduct }) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const existing = read().filter((p) => p.id !== current.id);
    // Show everything except the current product...
    setItems(existing.slice(0, 5));
    // ...then record the current product at the front for next time.
    const updated = [{ id: current.id, name: current.name, price: current.price, image_url: current.image_url }, ...existing].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(updated));
    } catch {
      /* storage unavailable */
    }
  }, [current.id, current.name, current.price, current.image_url]);

  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Recently Viewed</h2>
      <div className={styles.row}>
        {items.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} className={styles.card}>
            <div className={styles.imageWrap}>
              <Image src={p.image_url} alt={p.name} fill sizes="120px" style={{ objectFit: 'cover' }} />
            </div>
            <span className={styles.name}>{p.name}</span>
            <span className={styles.price}>${p.price.toFixed(2)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
