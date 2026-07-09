"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart, Product } from '../context/CartContext';
import StarRating from './StarRating';
import styles from './ProductCard.module.css';

export interface RatingBadge {
  average: number;
  count: number;
}

interface ProductCardProps {
  product: Product;
  rating?: RatingBadge;
}

export default function ProductCard({ product, rating }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <article className={`glass-card glass-card-hover animate-fade-in ${styles.card}`}>
      <div className={styles.cardHeader}>
        <div className={styles.imageWrapper}>
          <div className={styles.mockupImage}>
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className={styles.avatar}
              style={{ objectFit: 'cover' }}
            />
          </div>
          <span className={`badge badge-primary ${styles.categoryTag}`}>{product.category}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.title}>
          <Link href={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        {rating && rating.count > 0 && (
          <div className={styles.rating}>
            <StarRating value={rating.average} size={14} />
            <span className={styles.ratingCount}>({rating.count})</span>
          </div>
        )}
        <p className={styles.description}>{product.description.substring(0, 75)}...</p>
        
        <div className={styles.footer}>
          <span className={styles.price}>${product.price.toFixed(2)}</span>
          <span className={product.stock > 0 ? styles.inStock : styles.outOfStock}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
          </span>
        </div>

        <button 
          className="btn btn-primary w-full"
          onClick={() => addToCart(product)}
          disabled={product.stock <= 0}
          style={{ marginTop: '1.25rem' }}
        >
          {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </article>
  );
}
