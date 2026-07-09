"use client";
import React, { useState, FormEvent } from 'react';
import styles from './contact.module.css';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: 'Thanks! Your message has been sent — we’ll be in touch soon.' });
        setName(''); setEmail(''); setMessage('');
      } else {
        setStatus({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
      }
    } catch {
      setStatus({ type: 'error', text: 'Failed to connect to server.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={`${styles.form} glass-card`} onSubmit={handleSubmit} noValidate>
      {status && (
        <div className={status.type === 'success' ? styles.successAlert : styles.errorAlert} role="alert">
          {status.text}
        </div>
      )}
      <div className="form-group">
        <label htmlFor="contact-name">Your Name</label>
        <input id="contact-name" className="input-field" value={name} required minLength={2}
          onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="form-group">
        <label htmlFor="contact-email">Email Address</label>
        <input id="contact-email" type="email" className="input-field" value={email} required
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="form-group">
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" className="input-field" value={message} required minLength={10} maxLength={2000}
          rows={5} onChange={(e) => setMessage(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
