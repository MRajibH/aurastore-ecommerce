"use client";
import React, { useState, FormEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import StarRating from '@/components/StarRating';
import type { Review } from '@/lib/reviews/types';
import type { Discount } from '@/lib/discounts/types';
import type { AbandonedCart } from '@/lib/abandoned';
import styles from './admin.module.css';

type AdminReview = Review & { productName: string | null };

interface MetaConfig {
  pixelId: string | null;
  catalogId: string | null;
  brandName: string;
  siteUrl: string | null;
  businessId: string | null;
  hasAccessToken: boolean;
  connectedAt: number | null;
  feedUrl: string;
  facebookAppId: string | null;
  loginConfigId: string | null;
}

interface AdminClientProps {
  stats: {
    totalRevenue: number;
    ordersCount: number;
    productsCount: number;
    avgOrderValue: number;
    usersCount: number;
  };
  products: any[];
  lowStockProducts: any[];
  orders: any[];
  users: any[];
  carouselSlides: any[];
  currentUserId: string;
  meta: MetaConfig;
  reviews: AdminReview[];
  discounts: Discount[];
  retention: { subscriberCount: number; abandonedCarts: AbandonedCart[] };
  topProducts: { name: string; units: number; revenue: number }[];
}

export default function AdminClient({ stats, products, lowStockProducts, orders, users, carouselSlides, currentUserId, meta, reviews, discounts, retention, topProducts }: AdminClientProps) {
  const router = useRouter();

  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const sendRecovery = async (id: string) => {
    setRecoveringId(id);
    try {
      const res = await fetch(`/api/admin/abandoned/${id}/recover`, { method: 'POST' });
      alert(res.ok ? 'Recovery email sent.' : 'Failed to send recovery email.');
    } finally {
      setRecoveringId(null);
    }
  };
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'customers' | 'carousel' | 'marketing' | 'reviews' | 'discounts'>('overview');

  // --- Discounts ---
  const [discForm, setDiscForm] = useState({ code: '', type: 'percent', value: '', minSubtotal: '', usageLimit: '' });
  const [discError, setDiscError] = useState<string | null>(null);
  const [discSaving, setDiscSaving] = useState(false);

  const handleCreateDiscount = async (e: FormEvent) => {
    e.preventDefault();
    setDiscSaving(true);
    setDiscError(null);
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discForm.code,
          type: discForm.type,
          value: Number(discForm.value),
          minSubtotal: discForm.minSubtotal ? Number(discForm.minSubtotal) : 0,
          usageLimit: discForm.usageLimit ? Number(discForm.usageLimit) : null,
          active: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiscForm({ code: '', type: 'percent', value: '', minSubtotal: '', usageLimit: '' });
        router.refresh();
      } else {
        setDiscError(data.error || 'Failed to create discount');
      }
    } catch {
      setDiscError('Failed to connect to server');
    } finally {
      setDiscSaving(false);
    }
  };

  const toggleDiscount = async (id: string, active: boolean) => {
    const res = await fetch(`/api/admin/discounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    });
    if (res.ok) router.refresh();
  };

  const removeDiscount = async (id: string) => {
    if (!confirm('Delete this discount code?')) return;
    const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  };

  const pendingReviewCount = reviews.filter((r) => r.status === 'pending').length;

  const updateReviewStatus = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
    else alert((await res.json()).error || 'Failed to update review');
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert((await res.json()).error || 'Failed to delete review');
  };

  // Product form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('Electronics');
  
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSuccess, setProductSuccess] = useState(false);
  const [productLoading, setProductLoading] = useState(false);

  // Uploads an image file to the server and returns its public URL.
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Image upload failed');
    return data.url as string;
  };

  const handleProductImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setProductError(null);
    try {
      setImageUrl(await uploadImage(file));
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setGalleryUploading(true);
    setProductError(null);
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)));
      setGallery((prev) => [...prev, ...urls].slice(0, 10));
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setGalleryUploading(false);
      e.target.value = ''; // allow re-selecting the same files
    }
  };

  const moveGalleryImage = (index: number, dir: -1 | 1) => {
    setGallery((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeGalleryImage = (url: string) => {
    setGallery((prev) => prev.filter((u) => u !== url));
  };

  // Field validation states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');

  const validateField = (fieldName: string, value: string) => {
    let err = '';
    if (fieldName === 'name' && value.trim().length < 2) {
      err = 'Name must be at least 2 characters.';
    } else if (fieldName === 'description' && value.trim().length < 10) {
      err = 'Description must be at least 10 characters.';
    } else if (fieldName === 'price' && (isNaN(Number(value)) || Number(value) <= 0)) {
      err = 'Price must be a positive number.';
    } else if (fieldName === 'stock' && (isNaN(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value)))) {
      err = 'Stock must be a non-negative integer.';
    }

    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: err
    }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    validateField(e.target.name, e.target.value);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProductLoading(true);
    setProductError(null);
    setProductSuccess(false);

    validateField('name', name);
    validateField('description', description);
    validateField('price', price);
    validateField('stock', stock);

    const hasErrors = Object.values(fieldErrors).some(err => err !== '') || 
                      !name || !description || !price || !stock;

    if (hasErrors) {
      setProductError('Please fix all form validation errors.');
      setProductLoading(false);
      return;
    }

    try {
      const url = editProductId ? `/api/admin/products/${editProductId}` : '/api/admin/products';
      const method = editProductId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          price: Number(price),
          stock: Number(stock),
          category,
          // Omit when empty so the API keeps the existing image (edit) or
          // applies the default placeholder (create).
          image_url: imageUrl || undefined,
          gallery,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProductError(data.error || 'Failed to save product');
        setProductLoading(false);
        return;
      }

      setProductSuccess(true);
      resetProductForm();
      router.refresh();
    } catch (err) {
      setProductError('Failed to connect to server');
    } finally {
      setProductLoading(false);
    }
  };

  const resetProductForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setStock('');
    setCategory('Electronics');
    setImageUrl('');
    setGallery([]);
    setEditProductId(null);
    setFieldErrors({});
  };

  const handleEditClick = (product: any) => {
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setCategory(product.category);
    setImageUrl(product.image_url || '');
    setGallery(Array.isArray(product.gallery) ? product.gallery : []);
    setEditProductId(product.id);
    setProductError(null);
    setProductSuccess(false);
    setActiveTab('products');
    
    // Scroll to form smoothly
    setTimeout(() => {
      const formElement = document.getElementById('product-form-container');
      formElement?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? Historical order data will remain intact.')) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update order status');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    const actionText = newRole === 'admin' ? 'promote this user to Administrator' : 'demote this user to Customer';
    if (!confirm(`Are you sure you want to ${actionText}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user role');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user profile? Account details will be permanently removed.')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  // Carousel states
  const [slideTitle, setSlideTitle] = useState('');
  const [slideSubtitle, setSlideSubtitle] = useState('');
  const [slideImageUrl, setSlideImageUrl] = useState('');
  const [slideLinkUrl, setSlideLinkUrl] = useState('');
  const [slideDisplayOrder, setSlideDisplayOrder] = useState('0');
  const [slideIsActive, setSlideIsActive] = useState(true);
  const [editSlideId, setEditSlideId] = useState<string | null>(null);
  const [slideError, setSlideError] = useState<string | null>(null);
  const [slideSuccess, setSlideSuccess] = useState(false);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideImageUploading, setSlideImageUploading] = useState(false);

  const handleSlideImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlideImageUploading(true);
    setSlideError(null);
    try {
      setSlideImageUrl(await uploadImage(file));
    } catch (err) {
      setSlideError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setSlideImageUploading(false);
    }
  };

  const resetSlideForm = () => {
    setSlideTitle('');
    setSlideSubtitle('');
    setSlideImageUrl('');
    setSlideLinkUrl('');
    setSlideDisplayOrder('0');
    setSlideIsActive(true);
    setEditSlideId(null);
    setSlideError(null);
  };

  const handleSlideSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSlideLoading(true);
    setSlideError(null);
    setSlideSuccess(false);

    if (!slideTitle.trim() || !slideSubtitle.trim() || !slideImageUrl.trim() || !slideLinkUrl.trim()) {
      setSlideError('All fields are required.');
      setSlideLoading(false);
      return;
    }

    try {
      const url = editSlideId ? `/api/admin/carousel/${editSlideId}` : '/api/admin/carousel';
      const method = editSlideId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: slideTitle,
          subtitle: slideSubtitle,
          image_url: slideImageUrl,
          link_url: slideLinkUrl,
          display_order: parseInt(slideDisplayOrder) || 0,
          is_active: slideIsActive ? 1 : 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSlideSuccess(true);
        resetSlideForm();
        router.refresh();
      } else {
        setSlideError(data.error || 'Failed to save slide');
      }
    } catch (err) {
      setSlideError('Failed to connect to server');
    } finally {
      setSlideLoading(false);
    }
  };

  const handleEditSlideClick = (slide: any) => {
    setSlideTitle(slide.title);
    setSlideSubtitle(slide.subtitle);
    setSlideImageUrl(slide.image_url);
    setSlideLinkUrl(slide.link_url);
    setSlideDisplayOrder(slide.display_order.toString());
    setSlideIsActive(slide.is_active === 1);
    setEditSlideId(slide.id);
    setSlideError(null);
    setSlideSuccess(false);
    
    // Scroll to form smoothly
    setTimeout(() => {
      const formElement = document.getElementById('slide-form-container');
      formElement?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    try {
      const res = await fetch(`/api/admin/carousel/${slideId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete slide');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  const handleToggleSlideActive = async (slide: any) => {
    try {
      const res = await fetch(`/api/admin/carousel/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: slide.title,
          subtitle: slide.subtitle,
          image_url: slide.image_url,
          link_url: slide.link_url,
          display_order: slide.display_order,
          is_active: slide.is_active === 1 ? 0 : 1
        })
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to toggle status');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  // --- Marketing / Meta integration state ---
  const [metaForm, setMetaForm] = useState({
    pixelId: meta.pixelId || '',
    catalogId: meta.catalogId || '',
    brandName: meta.brandName || '',
    siteUrl: meta.siteUrl || '',
    capiAccessToken: '',
    businessId: meta.businessId || '',
  });
  const [metaHasToken, setMetaHasToken] = useState(meta.hasAccessToken);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);

  const handleMetaFieldChange = (field: keyof typeof metaForm, value: string) => {
    setMetaForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMetaSave = async (e: FormEvent) => {
    e.preventDefault();
    setMetaSaving(true);
    setMetaMsg(null);
    try {
      const res = await fetch('/api/admin/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMetaMsg({ type: 'error', text: data.error || 'Failed to save settings' });
      } else {
        setMetaMsg({ type: 'success', text: 'Marketing settings saved.' });
        setMetaHasToken(data.settings?.hasAccessToken ?? metaHasToken);
        setMetaForm(prev => ({ ...prev, capiAccessToken: '' }));
        router.refresh();
      }
    } catch {
      setMetaMsg({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setMetaSaving(false);
    }
  };

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(meta.feedUrl);
      setFeedCopied(true);
      setTimeout(() => setFeedCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  // Launch the Facebook Login for Business flow. Requires a configured Meta App
  // (NEXT_PUBLIC_FACEBOOK_APP_ID + NEXT_PUBLIC_MBE_CONFIG_ID) and the FB JS SDK.
  const handleFacebookConnect = () => {
    const w = window as unknown as { FB?: { login: (cb: (r: unknown) => void, opts: unknown) => void } };
    if (!meta.facebookAppId || !meta.loginConfigId || !w.FB) {
      setMetaMsg({
        type: 'error',
        text: 'Facebook App not configured. Set NEXT_PUBLIC_FACEBOOK_APP_ID and NEXT_PUBLIC_MBE_CONFIG_ID, or use manual configuration below.',
      });
      return;
    }
    setFbConnecting(true);
    w.FB.login(
      async (response: unknown) => {
        const authResponse = (response as { authResponse?: { code?: string } }).authResponse;
        if (!authResponse?.code) {
          setMetaMsg({ type: 'error', text: 'Facebook connection was cancelled.' });
          setFbConnecting(false);
          return;
        }
        try {
          const res = await fetch('/api/admin/meta/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authResponse.code }),
          });
          const data = await res.json();
          if (!res.ok) {
            setMetaMsg({ type: 'error', text: data.error || 'Connection failed' });
          } else {
            setMetaMsg({ type: 'success', text: 'Facebook account connected.' });
            router.refresh();
          }
        } catch {
          setMetaMsg({ type: 'error', text: 'Failed to complete connection' });
        } finally {
          setFbConnecting(false);
        }
      },
      { config_id: meta.loginConfigId, response_type: 'code', override_default_response_type: true },
    );
  };

  // Filter customers list
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [users, customerSearch]);

  return (
    <div className={`${styles.container} container section-padding`}>
      <div className={styles.headerRow}>
        <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800 }}>
          Shop Management
        </h1>
        
        {/* Navigation Tabs */}
        <div className={styles.tabsList}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'products' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders ({orders.length})
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'customers' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            Customers
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'carousel' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('carousel')}
          >
            Carousel & Offers
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'discounts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('discounts')}
          >
            Discounts
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Reviews{pendingReviewCount > 0 ? ` (${pendingReviewCount})` : ''}
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'marketing' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('marketing')}
          >
            Marketing
          </button>
        </div>
      </div>

      {/* --- OVERVIEW TAB --- */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            <div className="glass-card">
              <span className={styles.statsLabel}>Total Sales</span>
              <span className={styles.statsValue} style={{ color: 'var(--accent)' }}>
                ${stats.totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="glass-card">
              <span className={styles.statsLabel}>Total Orders</span>
              <span className={styles.statsValue}>{stats.ordersCount}</span>
            </div>
            <div className="glass-card">
              <span className={styles.statsLabel}>Average Order Value</span>
              <span className={styles.statsValue}>
                ${stats.avgOrderValue.toFixed(2)}
              </span>
            </div>
            <div className="glass-card">
              <span className={styles.statsLabel}>Total Registered Users</span>
              <span className={styles.statsValue}>{stats.usersCount}</span>
            </div>
          </div>

          {/* Top Sellers */}
          <div className="glass-card" style={{ marginTop: '2rem' }}>
            <h2 className={styles.cardTitle}>🏆 Best Sellers</h2>
            {topProducts.length === 0 ? (
              <p className="text-secondary-color">No sales yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p.name}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.units}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${p.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="glass-card" style={{ marginTop: '2rem' }}>
            <h2 className={styles.cardTitle} style={{ color: 'var(--error)', borderBottomColor: 'rgba(248, 113, 113, 0.2)' }}>
              ⚠️ Stock Level Warnings
            </h2>
            {lowStockProducts.length === 0 ? (
              <p className={styles.alertSuccessText}>✓ All products in the catalog are adequately stocked.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock Level</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map(p => (
                      <tr key={p.id} className={styles.lowStockRow}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.category}</td>
                        <td>${p.price.toFixed(2)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--error)' }}>{p.stock} left</td>
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handleEditClick(p)}
                            style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PRODUCTS TAB --- */}
      {activeTab === 'products' && (
        <div className={`${styles.adminLayout} animate-fade-in`}>
          {/* Add / Edit Form */}
          <section id="product-form-container" className={styles.addProductSection}>
            <div className="glass-card">
              <h2 className={styles.cardTitle}>
                {editProductId ? 'Edit Product Details' : 'Add New Product'}
              </h2>
              
              {productError && <div className={styles.errorAlert}>{productError}</div>}
              {productSuccess && <div className={styles.successAlert}>Product saved successfully!</div>}

              <form onSubmit={handleProductSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="prod-name">Product Name</label>
                  <input
                    type="text"
                    id="prod-name"
                    name="name"
                    className="input-field"
                    required
                    value={name}
                    onChange={(e) => { setName(e.target.value); handleInput(e); }}
                    onBlur={handleBlur}
                  />
                  {fieldErrors.name && <span className={styles.fieldError}>{fieldErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="prod-description">Full Description</label>
                  <textarea
                    id="prod-description"
                    name="description"
                    className="input-field"
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); handleInput(e); }}
                    onBlur={handleBlur}
                    style={{ resize: 'vertical' }}
                  />
                  {fieldErrors.description && <span className={styles.fieldError}>{fieldErrors.description}</span>}
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="prod-price">Price ($)</label>
                    <input
                      type="number"
                      id="prod-price"
                      name="price"
                      className="input-field"
                      required
                      step="0.01"
                      min="0.01"
                      value={price}
                      onChange={(e) => { setPrice(e.target.value); handleInput(e); }}
                      onBlur={handleBlur}
                    />
                    {fieldErrors.price && <span className={styles.fieldError}>{fieldErrors.price}</span>}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="prod-stock">Stock Level</label>
                    <input
                      type="number"
                      id="prod-stock"
                      name="stock"
                      className="input-field"
                      required
                      min="0"
                      value={stock}
                      onChange={(e) => { setStock(e.target.value); handleInput(e); }}
                      onBlur={handleBlur}
                    />
                    {fieldErrors.stock && <span className={styles.fieldError}>{fieldErrors.stock}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="prod-category">Product Category</label>
                  <select
                    id="prod-category"
                    name="category"
                    className="input-field"
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); handleInput(e); }}
                    onBlur={handleBlur}
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Home & Living">Home & Living</option>
                    <option value="Fashion & Accessories">Fashion & Accessories</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="prod-image">Product Image</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--surface, rgba(255,255,255,0.05))', flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl || '/images/products/placeholder.svg'}
                        alt="Product preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <input
                        type="file"
                        id="prod-image"
                        name="image"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleProductImageChange}
                        disabled={imageUploading}
                      />
                      <span className={styles.fieldError} style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                        {imageUploading ? 'Uploading…' : 'JPEG, PNG, WebP or GIF up to 5 MB.'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="prod-gallery">Gallery Images (additional views)</label>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {gallery.map((url, i) => (
                      <div key={url} style={{ position: 'relative', width: '64px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Gallery item" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(url)}
                          aria-label="Remove image"
                          style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, boxShadow: 'var(--shadow-sm)' }}
                        >
                          ×
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                          <button type="button" onClick={() => moveGalleryImage(i, -1)} disabled={i === 0} aria-label="Move left"
                            style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>‹</button>
                          <button type="button" onClick={() => moveGalleryImage(i, 1)} disabled={i === gallery.length - 1} aria-label="Move right"
                            style={{ border: 'none', background: 'none', cursor: i === gallery.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>›</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input
                    type="file"
                    id="prod-gallery"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={handleGalleryChange}
                    disabled={galleryUploading || gallery.length >= 10}
                  />
                  <span className={styles.fieldError} style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                    {galleryUploading ? 'Uploading…' : `Add up to 10 extra images shown on the product page. (${gallery.length}/10)`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={productLoading || imageUploading || galleryUploading}
                    style={{ flex: 1 }}
                  >
                    {productLoading ? 'Saving...' : editProductId ? 'Update Product' : 'Create Product'}
                  </button>
                  {editProductId && (
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={resetProductForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* Products Grid / Table */}
          <section className={styles.ordersSection}>
            <h2 className={styles.sectionTitle}>Product Catalog Directory</h2>
            
            <div className="glass-card">
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.category}</td>
                        <td>${p.price.toFixed(2)}</td>
                        <td style={{ color: p.stock < 5 ? 'var(--error)' : 'var(--text-primary)', fontWeight: p.stock < 5 ? 700 : 500 }}>
                          {p.stock}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => handleEditClick(p)}
                              style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => handleDeleteProduct(p.id)}
                              style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* --- ORDERS TAB --- */}
      {activeTab === 'orders' && (
        <div className="animate-fade-in">
          <h2 className={styles.sectionTitle}>Invoice & Orders History</h2>
          {orders.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary-color">No orders placed yet.</p>
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
                      <span className={styles.orderLabel}>CUSTOMER</span>
                      <span className={styles.customerName}>{order.user_name} ({order.user_email})</span>
                    </div>
                  </div>

                  <div className={styles.orderBody}>
                    {/* Invoice items details list */}
                    <div className={styles.invoiceItemsBox}>
                      <span className={styles.orderLabel}>ITEMS ORDERED</span>
                      <div className={styles.itemsList}>
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className={styles.itemRow}>
                            <span>
                              {item.product_name || 'Deleted Product'} <span className={styles.itemQty}>x{item.quantity}</span>
                            </span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.shippingRow}>
                      <span className={styles.orderLabel}>SHIPPING TO</span>
                      <p className={styles.shippingText}>{order.shipping_address}</p>
                    </div>
                  </div>

                  <div className={styles.orderFooter}>
                    <div>
                      <span className={styles.orderLabel}>REVENUE</span>
                      <span className={styles.orderAmount}>${order.total_amount.toFixed(2)}</span>
                    </div>
                    
                    <div className={styles.actionsCell}>
                      <span className={`${styles.statusBadge} badge badge-primary`} style={{ textTransform: 'capitalize', marginRight: '1rem' }}>
                        {order.status}
                      </span>
                      
                      {order.status === 'paid' && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                          style={{ padding: '0.25rem 0.75rem', minHeight: '34px', fontSize: '0.8rem' }}
                        >
                          Ship Order
                        </button>
                      )}
                      
                      {order.status === 'shipped' && (
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          style={{ padding: '0.25rem 0.75rem', minHeight: '34px', fontSize: '0.8rem' }}
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CUSTOMERS TAB --- */}
      {activeTab === 'customers' && (
        <div className="glass-card animate-fade-in">
          <div className={styles.customerHeader}>
            <h2 className={styles.cardTitle} style={{ borderBottom: 'none', margin: 0, padding: 0 }}>
              Customer Directory
            </h2>
            {/* Customer Search */}
            <div className={styles.customerSearchBox}>
              <label htmlFor="customer-search" className="visually-hidden">Search Customers</label>
              <input
                type="text"
                id="customer-search"
                className="input-field"
                placeholder="Search customers by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Date Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-accent'}`}>
                        {u.role === 'admin' ? 'Administrator' : 'Customer'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.9rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* Toggle Role Button */}
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleToggleUserRole(u.id, u.role)}
                          disabled={u.id === currentUserId}
                          style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}
                        >
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        {/* Delete User Button */}
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.id === currentUserId}
                          style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--error)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CAROUSEL TAB --- */}
      {activeTab === 'carousel' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Slide Form */}
          <div id="slide-form-container" className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editSlideId ? 'Edit Slide / Offer' : 'Add New Slide / Offer'}
            </h2>
            <form onSubmit={handleSlideSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className={styles.label}>Slide Title</label>
                  <input
                    type="text"
                    className="input-field"
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    placeholder="e.g. AeroPro Wireless Earbuds"
                    required
                  />
                </div>
                <div>
                  <label className={styles.label}>Display Order</label>
                  <input
                    type="number"
                    className="input-field"
                    value={slideDisplayOrder}
                    onChange={(e) => setSlideDisplayOrder(e.target.value)}
                    placeholder="e.g. 1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={styles.label}>Subtitle / Promotion Text</label>
                <textarea
                  className="input-field"
                  value={slideSubtitle}
                  onChange={(e) => setSlideSubtitle(e.target.value)}
                  placeholder="e.g. Experience Sound in High Definition. Premium Active Noise Cancelling."
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className={styles.label}>Slide Image</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleSlideImageChange}
                    disabled={slideImageUploading}
                    style={{ display: 'block', marginBottom: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="input-field"
                    value={slideImageUrl}
                    onChange={(e) => setSlideImageUrl(e.target.value)}
                    placeholder="Upload above, or paste a path e.g. /images/products/earbuds.jpg"
                    required
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {slideImageUploading ? 'Uploading…' : 'Upload an image or enter a path manually.'}
                  </span>
                </div>
                <div>
                  <label className={styles.label}>Destination Link (URL)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={slideLinkUrl}
                    onChange={(e) => setSlideLinkUrl(e.target.value)}
                    placeholder="e.g. /products/p1"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="slideIsActive"
                  checked={slideIsActive}
                  onChange={(e) => setSlideIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="slideIsActive" style={{ fontWeight: 500, cursor: 'pointer' }}>
                  Is Active (Show on Homepage)
                </label>
              </div>

              {slideError && <div style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{slideError}</div>}
              {slideSuccess && <div style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>Slide saved successfully!</div>}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={slideLoading || slideImageUploading}>
                  {slideLoading ? 'Saving...' : editSlideId ? 'Update Slide' : 'Add Slide'}
                </button>
                {editSlideId && (
                  <button type="button" className="btn btn-secondary" onClick={resetSlideForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Slides List */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Active Slides & Offers ({carouselSlides.length})
            </h2>
            {carouselSlides.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No slides configured. Add one above to display on the homepage.</p>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Title / Subtitle</th>
                      <th>Link URL</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carouselSlides.map((slide) => (
                      <tr key={slide.id}>
                        <td>
                          <div style={{ width: '80px', height: '50px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                            <img
                              src={slide.image_url}
                              alt={slide.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{slide.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {slide.subtitle}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{slide.link_url}</td>
                        <td style={{ fontWeight: 600 }}>{slide.display_order}</td>
                        <td>
                          <span
                            className={`badge ${slide.is_active === 1 ? 'badge-primary' : 'badge-secondary'}`}
                            onClick={() => handleToggleSlideActive(slide)}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {slide.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleEditSlideClick(slide)}
                              style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDeleteSlide(slide.id)}
                              style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MARKETING / META TAB --- */}
      {activeTab === 'marketing' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Load the Facebook JS SDK only when a Meta App is configured */}
          {meta.facebookAppId && (
            <>
              <Script
                id="facebook-jssdk"
                strategy="afterInteractive"
                src="https://connect.facebook.net/en_US/sdk.js"
              />
              <Script id="facebook-jssdk-init" strategy="afterInteractive">
                {`window.fbAsyncInit=function(){FB.init({appId:'${meta.facebookAppId}',cookie:true,xfbml:false,version:'v21.0'});};`}
              </Script>
            </>
          )}

          {/* Connection status + Facebook onboarding */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Facebook &amp; Meta Integration</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Sync your product catalog and customer events to Meta for Advantage+ catalog ads and conversion tracking.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <span className={`badge ${meta.pixelId ? 'badge-primary' : 'badge-secondary'}`}>
                Pixel: {meta.pixelId ? 'Configured' : 'Not set'}
              </span>
              <span className={`badge ${metaHasToken ? 'badge-primary' : 'badge-secondary'}`}>
                Conversions API: {metaHasToken ? 'Connected' : 'Not connected'}
              </span>
              <span className={`badge ${meta.catalogId ? 'badge-primary' : 'badge-secondary'}`}>
                Catalog: {meta.catalogId ? meta.catalogId : 'Not linked'}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFacebookConnect}
              disabled={fbConnecting}
            >
              {fbConnecting ? 'Connecting…' : 'Connect with Facebook'}
            </button>
            {!meta.facebookAppId && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                One-click connect requires a registered Meta App. Set <code>NEXT_PUBLIC_FACEBOOK_APP_ID</code> and{' '}
                <code>NEXT_PUBLIC_MBE_CONFIG_ID</code>, or configure manually below.
              </p>
            )}
          </div>

          {/* Email & retention */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Email &amp; Retention</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {retention.subscriberCount} newsletter subscriber{retention.subscriberCount === 1 ? '' : 's'} · {retention.abandonedCarts.filter((c) => !c.recovered).length} open abandoned cart{retention.abandonedCarts.filter((c) => !c.recovered).length === 1 ? '' : 's'}
            </p>
            {retention.abandonedCarts.length === 0 ? (
              <p className="text-secondary-color">No abandoned carts captured yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr><th>Customer</th><th>Items</th><th>Subtotal</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {retention.abandonedCarts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name || 'Guest'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.email}</div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{c.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</td>
                        <td style={{ fontWeight: 600 }}>${c.subtotal.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${c.recovered ? 'badge-accent' : 'badge-secondary'}`}>
                            {c.recovered ? 'Recovered' : 'Open'}
                          </span>
                        </td>
                        <td>
                          {!c.recovered && (
                            <button className="btn btn-secondary" onClick={() => sendRecovery(c.id)} disabled={recoveringId === c.id}
                              style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}>
                              {recoveringId === c.id ? 'Sending…' : 'Send recovery'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Catalog feed URL */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Product Data Feed</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Add this URL as a <strong>scheduled feed</strong> in Meta Commerce Manager. Meta re-fetches it automatically
              (e.g. hourly) to keep prices and stock in sync.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="input-field"
                readOnly
                value={meta.feedUrl}
                onFocus={(e) => e.currentTarget.select()}
                style={{ flex: 1, minWidth: '260px', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <button type="button" className="btn btn-secondary" onClick={copyFeedUrl}>
                {feedCopied ? 'Copied!' : 'Copy'}
              </button>
              <a href={meta.feedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Open
              </a>
            </div>
          </div>

          {/* Manual configuration */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Manual Configuration</h2>

            {metaMsg && (
              <div style={{ marginBottom: '1rem', color: metaMsg.type === 'success' ? 'var(--accent)' : 'var(--error)', fontSize: '0.9rem' }}>
                {metaMsg.text}
              </div>
            )}

            <form onSubmit={handleMetaSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className={styles.label}>Pixel / Dataset ID</label>
                  <input type="text" className="input-field" value={metaForm.pixelId}
                    onChange={(e) => handleMetaFieldChange('pixelId', e.target.value)} placeholder="e.g. 1234567890123456" />
                </div>
                <div>
                  <label className={styles.label}>Catalog ID</label>
                  <input type="text" className="input-field" value={metaForm.catalogId}
                    onChange={(e) => handleMetaFieldChange('catalogId', e.target.value)} placeholder="e.g. 987654321098765" />
                </div>
              </div>

              <div>
                <label className={styles.label}>
                  Conversions API Access Token {metaHasToken && <span style={{ color: 'var(--accent)' }}>(a token is saved — leave blank to keep it)</span>}
                </label>
                <input type="password" className="input-field" value={metaForm.capiAccessToken} autoComplete="off"
                  onChange={(e) => handleMetaFieldChange('capiAccessToken', e.target.value)}
                  placeholder={metaHasToken ? '••••••••••••••••' : 'Paste your CAPI system-user token'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className={styles.label}>Brand / Store Name</label>
                  <input type="text" className="input-field" value={metaForm.brandName}
                    onChange={(e) => handleMetaFieldChange('brandName', e.target.value)} placeholder="AURA Store" />
                </div>
                <div>
                  <label className={styles.label}>Public Site URL</label>
                  <input type="text" className="input-field" value={metaForm.siteUrl}
                    onChange={(e) => handleMetaFieldChange('siteUrl', e.target.value)} placeholder="https://store.example.com" />
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={metaSaving}>
                  {metaSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DISCOUNTS TAB --- */}
      {activeTab === 'discounts' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 className={styles.cardTitle}>Create Discount Code</h2>
            {discError && <div className={styles.errorAlert}>{discError}</div>}
            <form onSubmit={handleCreateDiscount} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label className={styles.label}>Code</label>
                <input className="input-field" value={discForm.code} onChange={(e) => setDiscForm({ ...discForm, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" required />
              </div>
              <div>
                <label className={styles.label}>Type</label>
                <select className="input-field" value={discForm.type} onChange={(e) => setDiscForm({ ...discForm, type: e.target.value })}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className={styles.label}>Value</label>
                <input type="number" step="0.01" min="0" className="input-field" value={discForm.value} onChange={(e) => setDiscForm({ ...discForm, value: e.target.value })} placeholder={discForm.type === 'percent' ? '20' : '15'} required />
              </div>
              <div>
                <label className={styles.label}>Min. subtotal ($)</label>
                <input type="number" step="0.01" min="0" className="input-field" value={discForm.minSubtotal} onChange={(e) => setDiscForm({ ...discForm, minSubtotal: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className={styles.label}>Usage limit</label>
                <input type="number" min="1" className="input-field" value={discForm.usageLimit} onChange={(e) => setDiscForm({ ...discForm, usageLimit: e.target.value })} placeholder="∞" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={discSaving}>{discSaving ? 'Creating…' : 'Create Code'}</button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 className={styles.cardTitle}>Active Codes ({discounts.length})</h2>
            {discounts.length === 0 ? (
              <p className="text-secondary-color">No discount codes yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr><th>Code</th><th>Discount</th><th>Min. Order</th><th>Used</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {discounts.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{d.code}</td>
                        <td>{d.type === 'percent' ? `${d.value}%` : `$${d.value.toFixed(2)}`} off</td>
                        <td>{d.minSubtotal > 0 ? `$${d.minSubtotal.toFixed(2)}` : '—'}</td>
                        <td>{d.usedCount}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                        <td>
                          <span className={`badge ${d.active ? 'badge-accent' : 'badge-secondary'}`}>{d.active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn btn-secondary" onClick={() => toggleDiscount(d.id, !d.active)} style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}>
                              {d.active ? 'Disable' : 'Enable'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => removeDiscount(d.id)} style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--error)' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- REVIEWS MODERATION TAB --- */}
      {activeTab === 'reviews' && (
        <div className="glass-card animate-fade-in">
          <h2 className={styles.cardTitle}>Review Moderation</h2>
          {reviews.length === 0 ? (
            <p className="text-secondary-color">No reviews submitted yet.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Rating</th>
                    <th>Review</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.productName || '—'}</td>
                      <td><StarRating value={r.rating} size={14} /></td>
                      <td style={{ maxWidth: '320px' }}>
                        {r.title && <div style={{ fontWeight: 600 }}>{r.title}</div>}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.body}</div>
                      </td>
                      <td>
                        {r.authorName}
                        {r.verified ? <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>✓ Verified</span> : null}
                      </td>
                      <td>
                        <span className={`badge ${r.status === 'approved' ? 'badge-accent' : r.status === 'rejected' ? 'badge-error' : 'badge-primary'}`} style={{ textTransform: 'capitalize' }}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {r.status !== 'approved' && (
                            <button className="btn btn-secondary" onClick={() => updateReviewStatus(r.id, 'approved')} style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--accent)' }}>Approve</button>
                          )}
                          {r.status !== 'rejected' && (
                            <button className="btn btn-secondary" onClick={() => updateReviewStatus(r.id, 'rejected')} style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}>Reject</button>
                          )}
                          <button className="btn btn-secondary" onClick={() => deleteReview(r.id)} style={{ padding: '0.2rem 0.5rem', minHeight: '32px', fontSize: '0.8rem', color: 'var(--error)' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
