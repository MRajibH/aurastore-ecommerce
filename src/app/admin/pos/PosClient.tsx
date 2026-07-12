"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { PaymentMethod, PosProduct, PosSaleResult } from '@/lib/pos/types';
import styles from './pos.module.css';

interface CartLine {
  product: PosProduct;
  quantity: number;
}

interface PosClientProps {
  cashierName: string;
  paymentLabels: Record<PaymentMethod, string>;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export default function PosClient({ cashierName, paymentLabels }: PosClientProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosProduct[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<PosSaleResult | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch products for the current query (debounced). Empty query = recent items.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      setLoadingResults(true);
      try {
        const res = await fetch(`/api/admin/pos/lookup?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) setResults(data.products ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Focus the scan/search field on mount.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addToCart = useCallback((product: PosProduct) => {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev; // respect stock
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (product.stock < 1) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const setLineQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, Math.min(qty, l.product.stock)) } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  // Scan behaviour: Enter adds an exact SKU/ID match, else the sole result.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const exact = results.find((p) => p.id.toLowerCase() === query.trim().toLowerCase());
    const target = exact ?? (results.length === 1 ? results[0] : null);
    if (target) {
      addToCart(target);
      setQuery('');
    }
  };

  const subtotal = useMemo(
    () => Math.round(cart.reduce((s, l) => s + l.product.price * l.quantity, 0) * 100) / 100,
    [cart],
  );
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const tenderedNum = parseFloat(tendered) || 0;
  // Preview change against subtotal (server applies any discount + is authoritative).
  const changePreview = Math.max(0, Math.round((tenderedNum - subtotal) * 100) / 100);
  const cashShort = paymentMethod === 'cash' && tenderedNum < subtotal;

  const completeSale = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          discountCode: discountCode.trim() || null,
          paymentMethod,
          amountTendered: paymentMethod === 'cash' ? tenderedNum : null,
          customerName: customerName.trim() || null,
          customerEmail: customerEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to complete the sale.');
        return;
      }
      setSale(data.sale as PosSaleResult);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const newSale = () => {
    setSale(null);
    setCart([]);
    setDiscountCode('');
    setCustomerName('');
    setCustomerEmail('');
    setPaymentMethod('cash');
    setTendered('');
    setError(null);
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  // ---- Receipt view ----
  if (sale) {
    const dt = new Date(sale.createdAt);
    return (
      <div className={styles.wrap}>
        <div className={styles.receiptScreen}>
          <div className={`${styles.receipt} pos-receipt`}>
            <div className={styles.receiptHead}>
              <div className={styles.receiptBrand}>AURA STORE</div>
              <div className={styles.receiptSub}>Sale Receipt</div>
            </div>
            <div className={styles.receiptMeta}>
              <div>Order #{sale.orderId.slice(0, 8).toUpperCase()}</div>
              <div>{dt.toLocaleString()}</div>
              <div>Served by {cashierName}</div>
              {sale.customerName && <div>Customer: {sale.customerName}</div>}
            </div>
            <table className={styles.receiptTable}>
              <tbody>
                {sale.lines.map((l) => (
                  <tr key={l.productId}>
                    <td>
                      {l.name}
                      <span className={styles.receiptQty}>× {l.quantity}</span>
                    </td>
                    <td className={styles.receiptAmt}>{money(l.price * l.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.receiptTotals}>
              <div><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
              {sale.discount > 0 && (
                <div><span>Discount{sale.discountCode ? ` (${sale.discountCode})` : ''}</span><span>−{money(sale.discount)}</span></div>
              )}
              {sale.tax > 0 && <div><span>Tax</span><span>{money(sale.tax)}</span></div>}
              <div className={styles.receiptGrand}><span>Total</span><span>{money(sale.total)}</span></div>
              <div><span>Paid ({paymentLabels[sale.paymentMethod]})</span><span>{money(sale.amountTendered ?? sale.total)}</span></div>
              {sale.changeDue != null && <div><span>Change</span><span>{money(sale.changeDue)}</span></div>}
            </div>
            <div className={styles.receiptFoot}>Thank you for shopping with AURA Store!</div>
          </div>

          <div className={styles.receiptActions}>
            <button className="btn btn-secondary" onClick={() => window.print()}>Print receipt</button>
            <button className="btn btn-primary" onClick={newSale}>New sale</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Register view ----
  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Point of Sale</h1>
          <p className={styles.cashier}>Register · {cashierName}</p>
        </div>
        <Link href="/admin" className={styles.backLink}>← Back to admin</Link>
      </div>

      <div className={styles.layout}>
        {/* Catalog */}
        <section className={styles.catalog}>
          <input
            ref={searchRef}
            className={`input-field ${styles.search}`}
            placeholder="Scan barcode / SKU or search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Scan or search products"
          />
          <div className={styles.grid}>
            {loadingResults && results.length === 0 ? (
              <p className={styles.hint}>Searching…</p>
            ) : results.length === 0 ? (
              <p className={styles.hint}>No products found.</p>
            ) : (
              results.map((p) => {
                const out = p.stock < 1;
                return (
                  <button
                    key={p.id}
                    className={styles.tile}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    title={out ? 'Out of stock' : `Add ${p.name}`}
                  >
                    <span className={styles.tileImg}>
                      <Image src={p.image_url} alt="" fill sizes="120px" style={{ objectFit: 'cover' }} />
                    </span>
                    <span className={styles.tileName}>{p.name}</span>
                    <span className={styles.tileMeta}>
                      <span className={styles.tilePrice}>{money(p.price)}</span>
                      <span className={out ? styles.tileOut : styles.tileStock}>{out ? 'Out' : `${p.stock} in stock`}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Ticket */}
        <aside className={styles.ticket}>
          <h2 className={styles.ticketTitle}>Current Sale{itemCount > 0 ? ` · ${itemCount}` : ''}</h2>

          <div className={styles.lines}>
            {cart.length === 0 ? (
              <p className={styles.emptyCart}>Scan or tap a product to start a sale.</p>
            ) : (
              cart.map((l) => (
                <div key={l.product.id} className={styles.line}>
                  <div className={styles.lineInfo}>
                    <span className={styles.lineName}>{l.product.name}</span>
                    <span className={styles.lineUnit}>{money(l.product.price)} each</span>
                  </div>
                  <div className={styles.qty}>
                    <button onClick={() => setLineQty(l.product.id, l.quantity - 1)} aria-label="Decrease">−</button>
                    <span>{l.quantity}</span>
                    <button
                      onClick={() => setLineQty(l.product.id, l.quantity + 1)}
                      disabled={l.quantity >= l.product.stock}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.lineAmt}>{money(l.product.price * l.quantity)}</span>
                  <button className={styles.lineRemove} onClick={() => removeLine(l.product.id)} aria-label="Remove">×</button>
                </div>
              ))
            )}
          </div>

          <div className={styles.checkout}>
            <div className={styles.field}>
              <label htmlFor="pos-discount">Discount code</label>
              <input id="pos-discount" className="input-field" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Optional" />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="pos-cust-name">Customer name</label>
                <input id="pos-cust-name" className="input-field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" />
              </div>
              <div className={styles.field}>
                <label htmlFor="pos-cust-email">Email (receipt)</label>
                <input id="pos-cust-email" type="email" className="input-field" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className={styles.field}>
              <label>Payment method</label>
              <div className={styles.payMethods}>
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.payBtn} ${paymentMethod === m ? styles.payBtnActive : ''}`}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {paymentLabels[m]}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="pos-tendered">Cash received</label>
                  <input id="pos-tendered" type="number" min="0" step="0.01" className="input-field" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.changeBox}>
                  <span className={styles.changeLabel}>Change</span>
                  <span className={styles.changeValue}>{money(changePreview)}</span>
                </div>
              </div>
            )}

            <div className={styles.summary}>
              <div className={styles.summaryRow}><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Total</span><span>{money(subtotal)}</span></div>
              {discountCode.trim() && <p className={styles.discountNote}>Discount is validated & applied when you complete the sale.</p>}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={`btn btn-primary w-full ${styles.complete}`}
              onClick={completeSale}
              disabled={cart.length === 0 || submitting || cashShort}
            >
              {submitting ? 'Processing…' : cashShort ? 'Insufficient cash' : `Complete sale · ${money(subtotal)}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
