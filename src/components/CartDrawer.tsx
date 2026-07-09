"use client";
import React, { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/checkout/config';
import styles from './CartDrawer.module.css';

export default function CartDrawer() {
  const { cart, cartTotal, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCartOpen) {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartOpen, setIsCartOpen]);

  // Trap focus within the drawer when open (Accessibility enhancement)
  useEffect(() => {
    if (!isCartOpen) return;
    
    const focusableElements = drawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    if (!focusableElements || focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    firstElement.focus();

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setIsCartOpen(false)}>
      <div 
        ref={drawerRef}
        className={styles.drawer} 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true" 
        aria-label="Shopping Cart"
      >
        <div className={styles.header}>
          <h2>Shopping Cart</h2>
          <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)} aria-label="Close cart">
            &times;
          </button>
        </div>

        <div className={styles.body}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <p>Your cart is empty.</p>
              <button className="btn btn-primary" onClick={() => setIsCartOpen(false)} style={{ marginTop: '1rem' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className={styles.itemsList}>
              {cart.map((item) => (
                <div key={item.product.id} className={styles.item}>
                  <div className={styles.imagePlaceholder} style={{ position: 'relative' }}>
                    <Image
                      src={item.product.image_url}
                      alt={item.product.name}
                      fill
                      sizes="64px"
                      style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <div className={styles.details}>
                    <h3>{item.product.name} — ${item.product.price.toFixed(2)}</h3>
                    <div className={styles.qtyContainer}>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button 
                    className={styles.removeBtn} 
                    onClick={() => removeFromCart(item.product.id)}
                    aria-label={`Remove ${item.product.name} from cart`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            {/* Free-shipping progress — a proven AOV lever */}
            {(() => {
              const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal);
              const pct = Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD) * 100);
              return (
                <div className={styles.freeShip}>
                  <p className={styles.freeShipText}>
                    {remaining > 0
                      ? <>Add <strong>${remaining.toFixed(2)}</strong> for <strong>free shipping</strong> 🚚</>
                      : <>🎉 You&apos;ve unlocked <strong>free shipping!</strong></>}
                  </p>
                  <div className={styles.freeShipTrack}>
                    <div className={styles.freeShipFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <Link 
              href="/checkout" 
              className="btn btn-primary w-full"
              onClick={() => setIsCartOpen(false)}
            >
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
