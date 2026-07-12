"use client";
import React, { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import styles from './profile.module.css';

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  address: string | null;
  created_at: number;
}

interface OrderItem {
  quantity: number;
  price: number;
  product_name: string | null;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  shipping_address: string;
  created_at: number;
  items: OrderItem[];
}

interface ProfileClientProps {
  user: ProfileUser;
  orders: Order[];
  stats: { orderCount: number; totalSpent: number };
}

type Message = { type: 'success' | 'error'; text: string } | null;

export default function ProfileClient({ user, orders, stats }: ProfileClientProps) {
  const router = useRouter();

  // --- Avatar ---
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setAvatarUrl(data.url);
        router.refresh(); // update the navbar avatar
      } else {
        setInfoMsg({ type: 'error', text: data.error || 'Failed to upload photo' });
      }
    } catch {
      setInfoMsg({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setAvatarUploading(false);
    }
  };

  // --- Profile info ---
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [address, setAddress] = useState(user.address || '');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<Message>(null);

  const handleInfoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInfoSaving(true);
    setInfoMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, bio, address }),
      });
      const data = await res.json();
      if (res.ok) {
        setInfoMsg({ type: 'success', text: 'Profile updated successfully.' });
        router.refresh();
      } else {
        setInfoMsg({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch {
      setInfoMsg({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setInfoSaving(false);
    }
  };

  // --- Password ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<Message>(null);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: 'success', text: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwMsg({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setPwSaving(false);
    }
  };

  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className={`${styles.container} container section-padding`}>
      <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem' }}>
        My Dashboard
      </h1>

      <div className={styles.profileLayout}>
        {/* --- Left: identity + stats --- */}
        <section className={`${styles.accountCard} glass-card`}>
          <div className={styles.avatarBlock}>
            <button
              type="button"
              className={styles.avatarWrap}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              disabled={avatarUploading}
            >
              <Avatar
                src={avatarUrl}
                name={user.name}
                sizes="110px"
                maxInitials={2}
                initialsClassName={styles.avatarInitials}
              />
              <span className={styles.avatarOverlay}>{avatarUploading ? '…' : 'Edit'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            <h2 className={styles.profileName}>{user.name}</h2>
            <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-accent'}`}>
              {user.role === 'admin' ? 'Administrator' : 'Customer'}
            </span>
            <p className={styles.memberSince}>Member since {memberSince}</p>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{stats.orderCount}</span>
              <span className={styles.statLabel}>Orders</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>${stats.totalSpent.toFixed(2)}</span>
              <span className={styles.statLabel}>Total Spent</span>
            </div>
          </div>

          <div className={styles.contactList}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email</span>
              <span className={styles.detailValue}>{user.email}</span>
            </div>
            {user.phone && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Phone</span>
                <span className={styles.detailValue}>{user.phone}</span>
              </div>
            )}
          </div>

          {user.role === 'admin' && (
            <Link href="/admin" className="btn btn-secondary w-full" style={{ marginTop: '1rem' }}>
              Go to Admin Panel
            </Link>
          )}
        </section>

        {/* --- Right: editable sections --- */}
        <div className={styles.mainColumn}>
          {/* Edit profile */}
          <section className="glass-card">
            <h2 className={styles.cardTitle}>Edit Profile</h2>
            {infoMsg && (
              <div className={infoMsg.type === 'success' ? styles.successAlert : styles.errorAlert}>{infoMsg.text}</div>
            )}
            <form onSubmit={handleInfoSubmit}>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label htmlFor="p-name">Full Name</label>
                  <input id="p-name" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                </div>
                <div className="form-group">
                  <label htmlFor="p-email">Email Address</label>
                  <input id="p-email" type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label htmlFor="p-phone">Phone Number</label>
                  <input id="p-phone" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label htmlFor="p-address">Default Shipping Address</label>
                  <input id="p-address" className="input-field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="p-bio">Bio</label>
                <textarea id="p-bio" className="input-field" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us a little about yourself (optional)" style={{ resize: 'vertical' }} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={infoSaving || avatarUploading}>
                {infoSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </section>

          {/* Security */}
          <section className="glass-card">
            <h2 className={styles.cardTitle}>Security</h2>
            {pwMsg && (
              <div className={pwMsg.type === 'success' ? styles.successAlert : styles.errorAlert}>{pwMsg.text}</div>
            )}
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="p-current">Current Password</label>
                <input id="p-current" type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label htmlFor="p-new">New Password</label>
                  <input id="p-new" type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                </div>
                <div className="form-group">
                  <label htmlFor="p-confirm">Confirm New Password</label>
                  <input id="p-confirm" type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Order history */}
          <section>
            <h2 className={styles.sectionTitle}>Order History</h2>
            {orders.length === 0 ? (
              <div className="glass-card text-center" style={{ padding: '3rem' }}>
                <p className="text-secondary-color" style={{ marginBottom: '1.5rem' }}>You haven&apos;t placed any orders yet.</p>
                <Link href="/" className="btn btn-primary">Start Shopping</Link>
              </div>
            ) : (
              <div className={styles.ordersList}>
                {orders.map((order) => (
                  <div key={order.id} className={`${styles.orderCard} glass-card`}>
                    <div className={styles.orderHeader}>
                      <div>
                        <span className={styles.orderLabel}>ORDER ID</span>
                        <code className={styles.orderId}>{order.id}</code>
                      </div>
                      <div>
                        <span className={styles.orderLabel}>DATE PLACED</span>
                        <span className={styles.orderDate}>
                          {new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className={styles.orderBody}>
                      <div className={styles.itemsList}>
                        {order.items.map((item, idx) => (
                          <div key={idx} className={styles.itemRow}>
                            <span>
                              {item.product_name || 'Deleted Product'} <span className={styles.itemQty}>x{item.quantity}</span>
                            </span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className={styles.shippingRow}>
                        <span className={styles.orderLabel}>SHIPPING TO</span>
                        <p className={styles.shippingAddress}>{order.shipping_address}</p>
                      </div>
                    </div>
                    <div className={styles.orderFooter}>
                      <div>
                        <span className={styles.orderLabel}>STATUS</span>
                        <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{order.status}</span>
                      </div>
                      <div>
                        <span className={styles.orderLabel}>TOTAL</span>
                        <span className={styles.orderTotal}>${order.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
