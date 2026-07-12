"use client";
import React, { useState, useEffect } from 'react';
import { useCart, Product } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard, { RatingBadge } from '@/components/ProductCard';
import StarRating from '@/components/StarRating';
import Breadcrumbs from '@/components/Breadcrumbs';
import RecentlyViewed from '@/components/RecentlyViewed';
import ProductReviews from './ProductReviews';
import type { Review, ReviewSummary } from '@/lib/reviews/types';
import { fbTrackWithCapi } from '@/lib/fbpixel';
import styles from './ProductDetailsClient.module.css';

interface ProductDetailsClientProps {
  product: Product;
  images: string[];
  videoUrl: string | null;
  related: Product[];
  reviewSummary: ReviewSummary;
  reviews: Review[];
  relatedRatings: Record<string, RatingBadge>;
  isLoggedIn: boolean;
  alreadyReviewed: boolean;
}

// Small inline line-icons for the trust/perk row
const icons = {
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" /></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0115.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
  ),
  zoom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
  ),
};

const perks = [
  { icon: icons.truck, title: 'Free Shipping', sub: 'On orders over $50' },
  { icon: icons.shield, title: '2-Year Warranty', sub: 'Full manufacturer cover' },
  { icon: icons.refresh, title: '30-Day Returns', sub: 'Hassle-free refunds' },
  { icon: icons.lock, title: 'Secure Checkout', sub: 'Encrypted payment' },
];

export default function ProductDetailsClient({
  product,
  images,
  videoUrl,
  related,
  reviewSummary,
  reviews,
  relatedRatings,
  isLoggedIn,
  alreadyReviewed,
}: ProductDetailsClientProps) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  // Gallery: which image is currently shown in the main viewer
  const gallery = images && images.length > 0 ? images : [product.image_url];
  const [activeImage, setActiveImage] = useState(0);

  // Video: shown as the first gallery item (poster = primary image) and played
  // in a lightbox. When featured, the main viewer shows the poster + play button.
  const hasVideo = !!videoUrl;
  const posterSrc = gallery[0];
  const [showVideoInMain, setShowVideoInMain] = useState(hasVideo);
  const [videoOpen, setVideoOpen] = useState(false);

  // Close the video lightbox on Escape and lock body scroll while it is open.
  useEffect(() => {
    if (!videoOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVideoOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [videoOpen]);

  // Product zoom state
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZoomed, setIsZoomed] = useState(false);

  // Report a product view to the Meta Pixel so it can be matched to the
  // catalog and used for dynamic ads / retargeting.
  useEffect(() => {
    fbTrackWithCapi('ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_category: product.category,
      content_type: 'product',
      value: product.price,
      currency: 'USD',
    });
  }, [product.id, product.name, product.category, product.price]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    fbTrackWithCapi('AddToCart', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: product.price * quantity,
      currency: 'USD',
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/checkout');
  };

  const lowStock = product.stock > 0 && product.stock < 10;

  // Estimated delivery window (3–5 business-ish days), formatted for display.
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const from = new Date(); from.setDate(from.getDate() + 3);
  const to = new Date(); to.setDate(to.getDate() + 5);

  return (
    <div className={`${styles.container} section-padding`}>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: product.category, href: '/#products' },
          { label: product.name },
        ]}
      />

      <div className={styles.layout}>
        {/* Product Gallery */}
        <div className={styles.gallery}>
          {(hasVideo || gallery.length > 1) && (
            <div className={styles.thumbs}>
              {hasVideo && (
                <button
                  className={`${styles.thumb} ${styles.videoThumb} ${showVideoInMain ? styles.thumbActive : ''}`}
                  onMouseEnter={() => setShowVideoInMain(true)}
                  onClick={() => { setShowVideoInMain(true); setVideoOpen(true); }}
                  aria-label="Play product video"
                  aria-current={showVideoInMain}
                >
                  <Image src={posterSrc} alt="" fill sizes="68px" style={{ objectFit: 'cover' }} />
                  <span className={styles.thumbPlayIcon} aria-hidden="true">{icons.play}</span>
                </button>
              )}
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  className={`${styles.thumb} ${!showVideoInMain && i === activeImage ? styles.thumbActive : ''}`}
                  onMouseEnter={() => { setShowVideoInMain(false); setActiveImage(i); }}
                  onClick={() => { setShowVideoInMain(false); setActiveImage(i); }}
                  aria-label={`View image ${i + 1} of ${gallery.length}`}
                  aria-current={!showVideoInMain && i === activeImage}
                >
                  <Image src={src} alt={`${product.name} view ${i + 1}`} fill sizes="68px" style={{ objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          <div className={styles.imageSection}>
            {showVideoInMain && hasVideo ? (
              <button
                type="button"
                className={styles.videoPoster}
                onClick={() => setVideoOpen(true)}
                aria-label="Play product video"
              >
                <Image
                  src={posterSrc}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  style={{ objectFit: 'cover' }}
                />
                <span className={styles.videoPosterPlay} aria-hidden="true">{icons.play}</span>
                <span className={styles.videoPosterLabel}>Watch video</span>
              </button>
            ) : (
              <div
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => {
                  setIsZoomed(false);
                  setZoomPos({ x: 50, y: 50 });
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'zoom-in',
                }}
              >
                <Image
                  src={gallery[activeImage]}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className={styles.avatarGlow}
                  style={{
                    objectFit: 'cover',
                    transform: isZoomed ? 'scale(2.2)' : 'scale(1)',
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transition: isZoomed ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <span className={styles.zoomBadge} style={{ opacity: isZoomed ? 0 : 1 }} aria-hidden="true">
                  {icons.zoom}
                </span>
                {gallery.length > 1 && (
                  <span className={styles.imageCount}>{activeImage + 1} / {gallery.length}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Video lightbox */}
        {videoOpen && hasVideo && (
          <div
            className={styles.videoModalOverlay}
            onClick={() => setVideoOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} video`}
          >
            <div className={styles.videoModalInner} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.videoModalClose}
                onClick={() => setVideoOpen(false)}
                aria-label="Close video"
              >
                ×
              </button>
              <video
                src={videoUrl!}
                controls
                autoPlay
                playsInline
                className={styles.videoModalPlayer}
              />
            </div>
          </div>
        )}

        {/* Product Info */}
        <div className={styles.infoSection}>
          <div className={styles.badgeRow}>
            <span className="badge badge-primary">{product.category}</span>
            {lowStock && <span className="badge badge-error">Only {product.stock} left</span>}
          </div>
          <h1 className={`${styles.title} gradient-text`}>{product.name}</h1>

          {reviewSummary.count > 0 && (
            <a href="#reviews" className={styles.ratingLink}>
              <StarRating value={reviewSummary.average} size={17} />
              <span>{reviewSummary.average.toFixed(1)}</span>
              <span className={styles.ratingCount}>
                ({reviewSummary.count} review{reviewSummary.count === 1 ? '' : 's'})
              </span>
            </a>
          )}

          <div className={styles.priceRow}>
            <span className={styles.price}>${product.price.toFixed(2)}</span>
            <span className={product.stock > 0 ? styles.inStock : styles.outOfStock}>
              {product.stock > 0 ? `✓ In stock — ${product.stock} available` : 'Out of Stock'}
            </span>
          </div>

          <p className={styles.description}>{product.description}</p>

          {product.stock > 0 ? (
            <>
              <div className={styles.cartActions}>
                <div className={styles.qtyPicker}>
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">-</button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button className="btn btn-primary" onClick={handleAddToCart}>Add to Cart</button>
                <button className="btn btn-secondary" onClick={handleBuyNow}>Buy Now</button>
              </div>

              {/* Delivery estimate */}
              <div className={styles.deliveryBox}>
                <span className={styles.deliveryIcon}>{icons.truck}</span>
                <div>
                  <strong>Free delivery</strong> on orders over $50
                  <div className={styles.deliveryEta}>Estimated arrival {fmt(from)} – {fmt(to)}</div>
                </div>
              </div>
            </>
          ) : (
            <button className="btn btn-primary" disabled style={{ width: 'fit-content' }}>Out of Stock</button>
          )}

          {/* Trust / perks */}
          <ul className={styles.perksGrid}>
            {perks.map((p) => (
              <li key={p.title} className={styles.perk}>
                <span className={styles.perkIcon}>{p.icon}</span>
                <div>
                  <div className={styles.perkTitle}>{p.title}</div>
                  <div className={styles.perkSub}>{p.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Details: specifications + shipping & returns */}
      <div className={styles.detailsGrid}>
        <section className="glass-card">
          <h2 className={styles.sectionTitle}>Product Details</h2>
          <p className={styles.detailsText}>{product.description}</p>
          <table className={styles.specTable}>
            <tbody>
              <tr><th>Brand</th><td>AURA Store</td></tr>
              <tr><th>Category</th><td>{product.category}</td></tr>
              <tr><th>Condition</th><td>New</td></tr>
              <tr><th>Availability</th><td>{product.stock > 0 ? 'In stock' : 'Out of stock'}</td></tr>
              <tr><th>SKU</th><td className={styles.sku}>{product.id}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="glass-card">
          <h2 className={styles.sectionTitle}>Shipping &amp; Returns</h2>
          <ul className={styles.shippingList}>
            <li><span className={styles.perkIcon}>{icons.truck}</span> Free standard shipping on orders over $50. Estimated delivery {fmt(from)} – {fmt(to)}.</li>
            <li><span className={styles.perkIcon}>{icons.refresh}</span> 30-day hassle-free returns. Return it if it&apos;s not the perfect fit.</li>
            <li><span className={styles.perkIcon}>{icons.shield}</span> Covered by a 2-year manufacturer warranty.</li>
            <li><span className={styles.perkIcon}>{icons.lock}</span> Secure, encrypted checkout. Your payment details are protected.</li>
          </ul>
        </section>
      </div>

      {/* Customer reviews */}
      <ProductReviews
        productId={product.id}
        summary={reviewSummary}
        reviews={reviews}
        isLoggedIn={isLoggedIn}
        alreadyReviewed={alreadyReviewed}
      />

      {/* Suggested products */}
      {related.length > 0 && (
        <section className={styles.relatedSection}>
          <div className={styles.relatedHeader}>
            <h2 className={styles.sectionTitle}>You May Also Like</h2>
            <Link href="/#products" className={styles.viewAll}>View all →</Link>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} rating={relatedRatings[p.id]} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed
        current={{ id: product.id, name: product.name, price: product.price, image_url: product.image_url }}
      />
    </div>
  );
}
