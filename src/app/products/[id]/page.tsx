import db from "@/lib/db/client";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailsClient from "./ProductDetailsClient";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import { validateSession } from "@/lib/auth/session";
import { getApprovedReviews, getReviewSummary, getSummariesForProducts, userAlreadyReviewed } from "@/lib/reviews";
import type { RatingBadge } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

function getProduct(id: string) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) return { title: "Product not found" };

  const url = `/products/${product.id}`;
  const image = absoluteUrl(product.image_url);
  const description = product.description.slice(0, 160);

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: `${product.name} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(url),
      images: [{ url: image, width: 1200, height: 1200, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${SITE_NAME}`,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  // Secure parameter binding query
  const product = getProduct(id);

  if (!product) {
    notFound();
  }

  // Gallery: primary image first, then any additional images (deduped).
  const extraImages = db.prepare(
    "SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC"
  ).all(id) as { url: string }[];
  const images = Array.from(new Set([product.image_url, ...extraImages.map((r) => r.url)]));

  // Suggested products: same category first, then newest others, up to 4.
  const related = db.prepare(`
    SELECT * FROM products
    WHERE id != ?
    ORDER BY CASE WHEN category = ? THEN 0 ELSE 1 END, created_at DESC
    LIMIT 4
  `).all(id, product.category) as any[];

  // Reviews + who is viewing (for the write-review affordance).
  const session = await validateSession();
  const reviews = getApprovedReviews(id);
  const summary = getReviewSummary(id);
  const alreadyReviewed = session ? userAlreadyReviewed(session.user.id, id) : false;

  // Star badges for the related-product cards.
  const relatedSummaries = getSummariesForProducts(related.map((r) => r.id));
  const relatedRatings: Record<string, RatingBadge> = {};
  relatedSummaries.forEach((s, pid) => { relatedRatings[pid] = { average: s.average, count: s.count }; });

  // Structured data for rich results (product, price, availability, breadcrumb).
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images.map((u) => absoluteUrl(u)),
    sku: product.id,
    brand: { "@type": "Brand", name: SITE_NAME },
    category: product.category,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.id}`),
      priceCurrency: "USD",
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  // Only include ratings when there are approved reviews (Google requires real data).
  if (summary.count > 0) {
    productLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: summary.average,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    };
    productLd.review = reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { "@type": "Person", name: r.authorName },
      datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
      ...(r.title ? { name: r.title } : {}),
      reviewBody: r.body,
    }));
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: product.category, item: `${SITE_URL}/#products` },
      { "@type": "ListItem", position: 3, name: product.name, item: absoluteUrl(`/products/${product.id}`) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ProductDetailsClient
        product={product}
        images={images}
        videoUrl={product.video_url ?? null}
        related={related}
        reviewSummary={summary}
        reviews={reviews}
        relatedRatings={relatedRatings}
        isLoggedIn={!!session}
        alreadyReviewed={alreadyReviewed}
      />
    </>
  );
}
