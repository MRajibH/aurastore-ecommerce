"use client";
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard, { RatingBadge } from './ProductCard';
import { Product } from '../context/CartContext';
import { fbTrackWithCapi } from '@/lib/fbpixel';
import styles from './ProductCatalog.module.css';

interface ProductCatalogProps {
  products: Product[];
  ratings?: Record<string, RatingBadge>;
}

const PAGE_SIZE = 8;

export default function ProductCatalog({ products, ratings }: ProductCatalogProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  // Fire a (debounced) Meta Search event so search intent flows to the catalog.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => fbTrackWithCapi('Search', { search_string: term }), 700);
    return () => clearTimeout(t);
  }, [search]);

  // Price ceiling for the range control.
  const priceCeiling = useMemo(
    () => Math.ceil(products.reduce((max, p) => Math.max(max, p.price), 0)),
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return products
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term);
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesStock = !inStockOnly || p.stock > 0;
        const matchesPrice = maxPrice === null || p.price <= maxPrice;
        return matchesSearch && matchesCategory && matchesStock && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        if (sortBy === 'rating') return (ratings?.[b.id]?.average ?? 0) - (ratings?.[a.id]?.average ?? 0);
        return 0;
      });
  }, [products, search, selectedCategory, sortBy, inStockOnly, maxPrice, ratings]);

  // Reset pagination whenever filters change.
  const filterSig = `${search}|${selectedCategory}|${sortBy}|${inStockOnly}|${maxPrice}`;
  const lastSig = React.useRef(filterSig);
  if (lastSig.current !== filterSig) {
    lastSig.current = filterSig;
    if (visible !== PAGE_SIZE) setVisible(PAGE_SIZE);
  }

  const shown = filtered.slice(0, visible);

  return (
    <section id="products" className={styles.section}>
      <div className={styles.filterBar}>
        <div className={styles.searchGroup}>
          <label htmlFor="catalog-search" className="visually-hidden">Search Products</label>
          <input
            type="text"
            id="catalog-search"
            className="input-field"
            placeholder="Search our collection..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.categories}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'} ${styles.categoryBtn}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.sortGroup}>
          <label htmlFor="catalog-sort" className="visually-hidden">Sort Products</label>
          <select id="catalog-sort" className="input-field" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="featured">Sort by: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="name-asc">Name: A-Z</option>
          </select>
        </div>
      </div>

      {/* Secondary facets */}
      <div className={styles.facetBar}>
        <span className={styles.resultCount}>{filtered.length} product{filtered.length === 1 ? '' : 's'}</span>
        <label className={styles.facetToggle}>
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          In stock only
        </label>
        <label className={styles.priceFacet}>
          Max price: <strong>${maxPrice ?? priceCeiling}</strong>
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={5}
            value={maxPrice ?? priceCeiling}
            onChange={(e) => setMaxPrice(Number(e.target.value) >= priceCeiling ? null : Number(e.target.value))}
            aria-label="Maximum price"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.noResults}>
          <p>No products match your search or filter preferences.</p>
        </div>
      ) : (
        <>
          <div className="product-grid">
            {shown.map((product) => (
              <ProductCard key={product.id} product={product} rating={ratings?.[product.id]} />
            ))}
          </div>
          {visible < filtered.length && (
            <div className={styles.loadMoreWrap}>
              <button className="btn btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Load more ({filtered.length - visible} more)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
