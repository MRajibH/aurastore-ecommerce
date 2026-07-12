"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import { useCart } from '../context/CartContext';
import styles from './Navbar.module.css';

interface NavbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url: string | null;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const { cartCount, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      // Full navigation so the root layout re-runs its session check and
      // the navbar reflects the signed-out state.
      window.location.assign('/');
    }
  };

  return (
    <header className={styles.header}>
      <div className={`${styles.navContainer} container`}>
        <Link href="/" className={styles.logo} onClick={() => setMobileMenuOpen(false)}>
          <span className={styles.logoMark} aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="11" stroke="white" strokeWidth="2.6" opacity="0.95" />
              <circle cx="16" cy="16" r="4" fill="white" />
            </svg>
          </span>
          <span className={styles.logoGlow}>AURA</span>
          <span className={styles.logoSub}>STORE</span>
        </Link>

        {/* Desktop Nav */}
        <nav className={styles.desktopNav}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/#products" className={styles.navLink}>Shop</Link>
          {user?.role === 'admin' && (
            <Link href="/admin" className={`${styles.navLink} ${styles.adminLink}`}>
              Admin Panel
            </Link>
          )}
        </nav>

        {/* Right side controls */}
        <div className={styles.actions}>
          {user ? (
            <div className={styles.userMenu}>
              <Link href="/profile" className={styles.profileLink} aria-label="View your profile">
                <span className={styles.avatarBadge}>
                  <Avatar src={user.avatar_url} name={user.name} sizes="32px" maxInitials={1} />
                </span>
                <span className={styles.userName}>Hi, {user.name.split(' ')[0]}</span>
              </Link>
              <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
            </div>
          ) : (
            <Link href="/login" className={styles.loginBtn}>Sign In</Link>
          )}

          <ThemeToggle />

          <button
            className={styles.cartIconBtn}
            onClick={() => setIsCartOpen(true)}
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className={styles.cartIcon}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {cartCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {cartCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu Toggle for Mobile */}
          <button 
            className={styles.hamburger} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className={mobileMenuOpen ? styles.barOpen1 : styles.bar1}></span>
            <span className={mobileMenuOpen ? styles.barOpen2 : styles.bar2}></span>
            <span className={mobileMenuOpen ? styles.barOpen3 : styles.bar3}></span>
          </button>
        </div>
      </div>

      {/* Mobile Nav overlay */}
      {mobileMenuOpen && (
        <div className={styles.mobileNav}>
          <Link href="/" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link href="/#products" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>Shop</Link>
          {user?.role === 'admin' && (
            <Link href="/admin" className={`${styles.mobileNavLink} ${styles.mobileAdminLink}`} onClick={() => setMobileMenuOpen(false)}>
              Admin Panel
            </Link>
          )}
          {user ? (
            <>
              <Link href="/profile" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                My Dashboard
              </Link>
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className={styles.mobileLogout}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className={styles.mobileLogin}>
              Sign In
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
