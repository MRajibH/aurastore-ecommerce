import db from "@/lib/db/client";
import ProductCatalog from "@/components/ProductCatalog";
import HomeCarousel from "@/components/HomeCarousel";
import Link from "next/link";
import styles from "./page.module.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import { getSummariesForProducts } from "@/lib/reviews";
import type { RatingBadge } from "@/components/ProductCard";

// Force Next.js to render this page dynamically (to query SQLite on every request)
export const dynamic = "force-dynamic";

export default async function Home() {
  // Query product records directly from the database on the server
  const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all() as any[];

  // Query active carousel slides from the database
  const slides = db.prepare("SELECT * FROM carousel_slides WHERE is_active = 1 ORDER BY display_order ASC").all() as any[];

  // Batch review summaries for star badges on the catalog cards (avoids N+1).
  const summaryMap = getSummariesForProducts(products.map((p) => p.id));
  const ratings: Record<string, RatingBadge> = {};
  summaryMap.forEach((s, id) => { ratings[id] = { average: s.average, count: s.count }; });

  // Organization + WebSite structured data (enables sitelinks search box)
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: `${SITE_URL}/icon.svg`,
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}#products`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className={styles.homeWrapper}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
      <div className="container" style={{ marginTop: '2rem' }}>
        {slides.length > 0 ? (
          <HomeCarousel slides={slides} />
        ) : (
          /* Hero Banner Section (Fallback) */
          <section className={styles.hero} style={{ marginBottom: '3.5rem' }}>
            <div className={`${styles.heroContent} container`}>
              <span className={styles.heroBadge}>NEW SEASON COLLECTION</span>
              <h1 className="gradient-text">Design for the Future of Comfort</h1>
              <p className="text-secondary-color">
                Discover a curated collection of state-of-the-art electronics, smart living accessories, and premium canvas wear. Built for the modern aesthetic.
              </p>
              <div className={styles.heroCtas}>
                <Link href="#products" className="btn btn-primary">
                  Explore Collection
                </Link>
                <Link href="/signup" className="btn btn-secondary">
                  Create Secure Account
                </Link>
              </div>
            </div>
            <div className={styles.heroGlow} />
          </section>
        )}
      </div>

      {/* Interactive catalog wrapper */}
      <div className="container">
        <ProductCatalog products={products} ratings={ratings} />
      </div>
    </div>
  );
}
