"use client";
import React, { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useCart } from '../../context/CartContext';
import Link from 'next/link';
import { fbTrackWithCapi, fbTrackBrowser } from '@/lib/fbpixel';
import { SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD, TAX_RATE } from '@/lib/checkout/config';
import type { PriceBreakdown } from '@/lib/checkout/pricing';
import styles from './checkout.module.css';

interface CheckoutClientProps {
  user: { id: string; name: string; email: string } | null;
}

export default function CheckoutClient({ user }: CheckoutClientProps) {
  const { cart, cartTotal, clearCart } = useCart();

  // Guest identity (only used when not logged in)
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Shipping + discount + server-computed pricing
  const [shippingMethod, setShippingMethod] = useState(SHIPPING_METHODS[0].id);
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const cartItems = cart.map((item) => ({ productId: item.product.id, quantity: item.quantity }));

  // --- Server-authoritative price quote ---
  const fetchQuote = useCallback(
    async (code: string | null) => {
      if (cart.length === 0) return;
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartItems: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
            discountCode: code ?? undefined,
            shippingMethod,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setQuote(data.breakdown);
          if (code) {
            if (data.discount.applied) { setAppliedCode(code); setDiscountMsg(null); }
            else { setAppliedCode(null); setDiscountMsg(data.discount.message); }
          }
        }
      } catch {
        /* keep last known quote */
      }
    },
    [cart, shippingMethod],
  );

  // Recompute when the cart or shipping method changes.
  useEffect(() => { fetchQuote(appliedCode); }, [fetchQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire InitiateCheckout once the cart has hydrated.
  const initiateFired = useRef(false);
  useEffect(() => {
    if (initiateFired.current || cart.length === 0 || successOrderId) return;
    initiateFired.current = true;
    fbTrackWithCapi('InitiateCheckout', {
      content_ids: cart.map((i) => i.product.id),
      content_type: 'product',
      num_items: cart.reduce((s, i) => s + i.quantity, 0),
      value: cartTotal,
      currency: 'USD',
    });
  }, [cart, cartTotal, successOrderId]);

  // Capture the cart for abandoned-cart recovery once we know an email
  // (logged-in user, or a guest who has entered a valid one). Sent at most once
  // per (email + cart) signature.
  const trackedSig = useRef('');
  useEffect(() => {
    if (successOrderId || cart.length === 0) return;
    const email = user?.email ?? (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail) ? guestEmail : null);
    if (!email) return;
    const sig = email + '|' + cart.map((i) => `${i.product.id}x${i.quantity}`).join(',');
    if (sig === trackedSig.current) return;
    trackedSig.current = sig;
    fetch('/api/cart/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems, email, name: (user?.name ?? guestName) || undefined }),
      keepalive: true,
    }).catch(() => {});
  }, [user, guestEmail, guestName, cart, successOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCode = () => {
    if (!codeInput.trim()) return;
    fetchQuote(codeInput.trim());
  };
  const removeCode = () => {
    setAppliedCode(null); setCodeInput(''); setDiscountMsg(null);
    fetchQuote(null);
  };

  const validateField = (name: string, value: string) => {
    let err = '';
    if (name === 'shippingAddress' && value.length < 10) err = 'Address must be at least 10 characters.';
    else if (name === 'guestName' && value.trim().length < 2) err = 'Please enter your name.';
    else if (name === 'guestEmail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) err = 'Please enter a valid email.';
    else if (name === 'cardNumber' && !/^\d{16}$/.test(value.replace(/\s+/g, ''))) err = 'Card number must be 16 digits.';
    else if (name === 'cardExp' && !/^\d{2}\/\d{2}$/.test(value)) err = 'Use MM/YY format.';
    else if (name === 'cardCvc' && !/^\d{3,4}$/.test(value)) err = 'CVC must be 3–4 digits.';
    else if (name === 'cardName' && value.trim().length < 2) err = 'Enter the cardholder name.';
    setFieldErrors((prev) => ({ ...prev, [name]: err }));
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => validateField(e.target.name, e.target.value);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const checks: [string, string][] = [
      ['shippingAddress', shippingAddress], ['cardName', cardName],
      ['cardNumber', cardNumber], ['cardExp', cardExp], ['cardCvc', cardCvc],
    ];
    if (!user) { checks.push(['guestName', guestName], ['guestEmail', guestEmail]); }
    checks.forEach(([n, v]) => validateField(n, v));

    const missing = checks.some(([, v]) => !v);
    const hasErrors = Object.values(fieldErrors).some((x) => x) || missing;
    if (hasErrors) {
      setError('Please resolve all fields before proceeding.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddress,
          cartItems,
          shippingMethod,
          discountCode: appliedCode ?? undefined,
          notes: notes || undefined,
          ...(user ? {} : { name: guestName, email: guestEmail }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        setLoading(false);
        return;
      }

      if (data.purchase?.eventId) {
        fbTrackBrowser('Purchase', {
          content_ids: data.purchase.content_ids,
          content_type: data.purchase.content_type,
          num_items: data.purchase.num_items,
          value: data.purchase.value,
          currency: data.purchase.currency,
        }, data.purchase.eventId);
      }

      setSuccessOrderId(data.orderId);
      clearCart();
    } catch {
      setError('Failed to contact server');
      setLoading(false);
    }
  };

  if (successOrderId) {
    return (
      <div className={`${styles.successWrapper} container section-padding`}>
        <div className="glass-card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className={styles.successIcon}>✓</div>
          <h1 className="gradient-primary-text" style={{ fontSize: '2.5rem', fontWeight: 800, marginBlock: '1.5rem' }}>
            Payment Successful!
          </h1>
          <p className="text-secondary-color" style={{ marginBottom: '1.5rem' }}>
            Thank you for your purchase. A confirmation has been sent to your email.
          </p>
          <div className={styles.orderNumberBox}>
            <span className="text-muted-color">ORDER ID</span>
            <code>{successOrderId}</code>
          </div>
          <Link href="/" className="btn btn-primary" style={{ marginTop: '2rem' }}>Continue Shopping</Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container section-padding text-center">
        <h1 className="gradient-text" style={{ marginBottom: '1.5rem' }}>Your Cart is Empty</h1>
        <p className="text-secondary-color" style={{ marginBottom: '2rem' }}>Please add products before checking out.</p>
        <Link href="/" className="btn btn-primary">Browse Products</Link>
      </div>
    );
  }

  const money = (n: number) => `$${n.toFixed(2)}`;
  const total = quote ? quote.total : cartTotal;

  return (
    <div className={`${styles.container} container section-padding`}>
      <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2.5rem' }}>Checkout</h1>

      <div className={styles.checkoutLayout}>
        <form onSubmit={handleSubmit} className={styles.checkoutForm} noValidate>
          {error && <div className={styles.errorAlert}>{error}</div>}

          {/* Guest / account */}
          {!user && (
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <h2 className={styles.cardTitle}>Your Details</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Checking out as a guest. <Link href="/login?redirectTo=/checkout" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link> for faster checkout.
              </p>
              <div className={styles.formRow}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="guest-name">Full Name</label>
                  <input id="guest-name" name="guestName" className="input-field" value={guestName}
                    onChange={(e) => setGuestName(e.target.value)} onBlur={handleBlur} autoComplete="name" required />
                  {fieldErrors.guestName && <span className={styles.fieldError}>{fieldErrors.guestName}</span>}
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="guest-email">Email</label>
                  <input id="guest-email" name="guestEmail" type="email" className="input-field" value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)} onBlur={handleBlur} autoComplete="email" required />
                  {fieldErrors.guestEmail && <span className={styles.fieldError}>{fieldErrors.guestEmail}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Shipping */}
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 className={styles.cardTitle}>Shipping Details</h2>
            <div className="form-group">
              <label htmlFor="checkout-address">Shipping Address</label>
              <textarea id="checkout-address" name="shippingAddress" className="input-field" required
                autoComplete="street-address" placeholder="123 Main St, Apt 4B, City, ZIP" value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)} onBlur={handleBlur} rows={3} style={{ resize: 'vertical' }} />
              {fieldErrors.shippingAddress && <span className={styles.fieldError}>{fieldErrors.shippingAddress}</span>}
            </div>

            <fieldset className={styles.shippingMethods}>
              <legend className={styles.legend}>Shipping Method</legend>
              {SHIPPING_METHODS.map((m) => {
                const free = quote?.freeShipping;
                return (
                  <label key={m.id} className={`${styles.shipOption} ${shippingMethod === m.id ? styles.shipOptionActive : ''}`}>
                    <input type="radio" name="shippingMethod" value={m.id} checked={shippingMethod === m.id}
                      onChange={() => setShippingMethod(m.id)} />
                    <span className={styles.shipInfo}>
                      <span className={styles.shipLabel}>{m.label}</span>
                      <span className={styles.shipEta}>{m.eta}</span>
                    </span>
                    <span className={styles.shipPrice}>{free && m.id === shippingMethod ? 'FREE' : money(m.amount)}</span>
                  </label>
                );
              })}
            </fieldset>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="order-notes">Order Notes (optional)</label>
              <textarea id="order-notes" className="input-field" value={notes} maxLength={1000} rows={2}
                onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, gift note, etc." style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Payment (mock) */}
          <div className="glass-card">
            <h2 className={styles.cardTitle}>🔒 Secure Payment</h2>
            <div className="form-group">
              <label htmlFor="card-name">Cardholder Name</label>
              <input id="card-name" name="cardName" className="input-field" required autoComplete="cc-name"
                value={cardName} onChange={(e) => setCardName(e.target.value)} onBlur={handleBlur} />
              {fieldErrors.cardName && <span className={styles.fieldError}>{fieldErrors.cardName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="card-number">Card Number</label>
              <input id="card-number" name="cardNumber" className="input-field" required autoComplete="cc-number"
                inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} onBlur={handleBlur} />
              {fieldErrors.cardNumber && <span className={styles.fieldError}>{fieldErrors.cardNumber}</span>}
            </div>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="card-exp">Expiry (MM/YY)</label>
                <input id="card-exp" name="cardExp" className="input-field" required placeholder="MM/YY" autoComplete="cc-exp"
                  value={cardExp} onChange={(e) => setCardExp(e.target.value)} onBlur={handleBlur} />
                {fieldErrors.cardExp && <span className={styles.fieldError}>{fieldErrors.cardExp}</span>}
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="card-cvc">CVC</label>
                <input id="card-cvc" name="cardCvc" className="input-field" required autoComplete="cc-csc" inputMode="numeric"
                  value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} onBlur={handleBlur} />
                {fieldErrors.cardCvc && <span className={styles.fieldError}>{fieldErrors.cardCvc}</span>}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ marginTop: '2rem' }}>
            {loading ? 'Processing…' : `Pay ${money(total)}`}
          </button>
        </form>

        {/* Summary */}
        <aside className={styles.summarySection}>
          <div className="glass-card">
            <h2 className={styles.cardTitle} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              Order Summary
            </h2>

            <div className={styles.summaryList}>
              {cart.map((item) => (
                <div key={item.product.id} className={styles.summaryItem}>
                  <div className={styles.summaryItemName}>
                    <span>{item.product.name}</span>
                    <span className={styles.summaryItemQty}>Qty: {item.quantity}</span>
                  </div>
                  <span className={styles.summaryItemPrice}>{money(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Promo code */}
            <div className={styles.promoRow}>
              {appliedCode ? (
                <div className={styles.promoApplied}>
                  <span>Code <strong>{appliedCode}</strong> applied</span>
                  <button type="button" onClick={removeCode} className={styles.promoRemove}>Remove</button>
                </div>
              ) : (
                <div className={styles.promoInput}>
                  <input className="input-field" placeholder="Promo code" value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)} aria-label="Promo code" />
                  <button type="button" className="btn btn-secondary" onClick={applyCode}>Apply</button>
                </div>
              )}
              {discountMsg && <span className={styles.fieldError}>{discountMsg}</span>}
            </div>

            {/* Breakdown */}
            <div className={styles.breakdown}>
              <div className={styles.breakdownRow}><span>Subtotal</span><span>{money(quote ? quote.subtotal : cartTotal)}</span></div>
              {quote && quote.discount > 0 && (
                <div className={`${styles.breakdownRow} ${styles.discountRow}`}>
                  <span>Discount{quote.discountCode ? ` (${quote.discountCode})` : ''}</span>
                  <span>−{money(quote.discount)}</span>
                </div>
              )}
              <div className={styles.breakdownRow}>
                <span>Shipping</span>
                <span>{quote ? (quote.freeShipping ? 'FREE' : money(quote.shipping)) : '—'}</span>
              </div>
              {quote && TAX_RATE > 0 && (
                <div className={styles.breakdownRow}><span>Tax</span><span>{money(quote.tax)}</span></div>
              )}
              {quote && !quote.freeShipping && (
                <p className={styles.freeShipHint}>
                  Add {money(Math.max(0, FREE_SHIPPING_THRESHOLD - (quote.subtotal - quote.discount)))} more for free shipping.
                </p>
              )}
            </div>

            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
