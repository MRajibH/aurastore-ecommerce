import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Us',
  description: `Learn about ${SITE_NAME} — our mission to bring curated, premium products with a delightful, secure shopping experience.`,
  alternates: { canonical: '/about' },
};

const VALUES = [
  { title: 'Curated quality', body: 'Every product is hand-picked and vetted so you can buy with confidence.' },
  { title: 'Fair pricing', body: 'Premium products at honest prices, with free shipping over $50.' },
  { title: 'Customer first', body: '30-day returns, a 2-year warranty, and support that actually helps.' },
  { title: 'Secure by design', body: 'Encrypted checkout and privacy-respecting analytics — your data stays yours.' },
];

const STATS = [
  { value: '50k+', label: 'Happy customers' },
  { value: '4.8★', label: 'Average rating' },
  { value: '24h', label: 'Dispatch time' },
];

export default function AboutPage() {
  return (
    <div className={`${styles.wrap} container section-padding`}>
      <header className={styles.hero}>
        <span className={styles.badge}>Our Story</span>
        <h1 className={`${styles.title} gradient-text`}>Premium products, thoughtfully curated.</h1>
        <p className={styles.lead}>
          {SITE_NAME} began with a simple idea: shopping for great electronics and smart-living
          essentials should feel effortless, trustworthy, and a little bit delightful. We obsess over
          product quality, fast delivery, and a checkout you can trust.
        </p>
      </header>

      <div className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <section className={styles.values}>
        {VALUES.map((v) => (
          <div key={v.title} className={`${styles.value} glass-card`}>
            <h2 className={styles.valueTitle}>{v.title}</h2>
            <p className={styles.valueBody}>{v.body}</p>
          </div>
        ))}
      </section>

      <div className={styles.cta}>
        <Link href="/#products" className="btn btn-primary">Explore the collection</Link>
        <Link href="/contact" className="btn btn-secondary">Contact us</Link>
      </div>
    </div>
  );
}
