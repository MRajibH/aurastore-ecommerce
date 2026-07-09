"use client";
import React, { useState, FormEvent } from 'react';
import styles from './Footer.module.css';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('done');
        setMessage(data.alreadySubscribed ? "You're already subscribed 🎉" : 'Subscribed! Check your inbox for 10% off.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to connect. Please try again.');
    }
  };

  return (
    <div>
      <h3 className={styles.colTitle}>Newsletter</h3>
      <p className={styles.newsletterText}>Get 10% off your first order + new arrivals.</p>
      {status === 'done' ? (
        <p className={styles.newsletterSuccess}>{message}</p>
      ) : (
        <form className={styles.newsletterForm} onSubmit={handleSubmit}>
          <input
            type="email"
            required
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
          <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
            {status === 'loading' ? '…' : 'Subscribe'}
          </button>
        </form>
      )}
      {status === 'error' && <p className={styles.newsletterError}>{message}</p>}
    </div>
  );
}
