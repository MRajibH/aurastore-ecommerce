import { validateSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import db from "@/lib/db/client";
import { getMetaSettings } from "@/lib/meta/settings";
import { listReviews } from "@/lib/reviews";
import { listDiscounts } from "@/lib/discounts";
import { subscriberCount } from "@/lib/email";
import { listAbandonedCarts } from "@/lib/abandoned";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1. Verify authenticated user has administrative privileges
  const sessionResult = await validateSession();
  if (!sessionResult) {
    redirect("/login?redirectTo=/admin");
  }
  if (sessionResult.user.role !== 'admin') {
    redirect("/");
  }

  // 2. Query dashboard metrics securely on the server with parameterized bindings
  const productsCountRow = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  const ordersCountRow = db.prepare("SELECT COUNT(*) as count FROM orders").get() as { count: number };
  const revenueRow = db.prepare("SELECT SUM(total_amount) as total FROM orders").get() as { total: number | null };
  const aovRow = db.prepare("SELECT AVG(total_amount) as aov FROM orders").get() as { aov: number | null };
  const usersCountRow = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  const stats = {
    productsCount: productsCountRow.count,
    ordersCount: ordersCountRow.count,
    totalRevenue: revenueRow.total || 0,
    avgOrderValue: aovRow.aov || 0,
    usersCount: usersCountRow.count,
  };

  // 3. Fetch all current products, each with its gallery of additional images
  const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all() as any[];
  const allImages = db.prepare("SELECT product_id, url FROM product_images ORDER BY sort_order ASC").all() as { product_id: string; url: string }[];
  const galleryByProduct = allImages.reduce<Record<string, string[]>>((acc, row) => {
    (acc[row.product_id] ||= []).push(row.url);
    return acc;
  }, {});
  for (const p of products) {
    p.gallery = galleryByProduct[p.id] || [];
  }

  // 4. Fetch low-stock alert items (stock < 5)
  const lowStockProducts = db.prepare("SELECT * FROM products WHERE stock < 5 ORDER BY stock ASC").all() as any[];

  // 5. Fetch order list with matched user names and email profiles
  const orders = db.prepare(`
    SELECT o.*, u.email as user_email, u.name as user_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all() as any[];

  // Fetch detailed line items for each order
  const ordersWithItems = orders.map((order) => {
    const items = db.prepare(`
      SELECT oi.quantity, oi.price, p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id) as any[];

    return {
      ...order,
      items,
    };
  });

  // 6. Fetch users list for directory management
  const users = db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `).all() as any[];

  // 7. Fetch all carousel slides
  const carouselSlides = db.prepare(`
    SELECT * FROM carousel_slides
    ORDER BY display_order ASC
  `).all() as any[];

  // 8. Resolve Meta marketing config (redacted) and the catalog feed URL
  const metaSettings = getMetaSettings();
  const headerList = await headers();
  const origin = metaSettings.siteUrl
    || `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host') || 'localhost:3000'}`;

  // Reviews for the moderation tab (all statuses, newest first)
  const reviews = listReviews();

  // Discount codes for the promotions tab
  const discounts = listDiscounts();

  // Retention data for the marketing tab
  const retention = { subscriberCount: subscriberCount(), abandonedCarts: listAbandonedCarts() };

  // Analytics: best-selling products by units sold
  const topProducts = db.prepare(`
    SELECT p.name as name, SUM(oi.quantity) as units, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    GROUP BY oi.product_id
    ORDER BY units DESC
    LIMIT 5
  `).all() as { name: string; units: number; revenue: number }[];

  const meta = {
    pixelId: metaSettings.pixelId,
    catalogId: metaSettings.catalogId,
    brandName: metaSettings.brandName,
    siteUrl: metaSettings.siteUrl,
    businessId: metaSettings.businessId,
    hasAccessToken: !!metaSettings.capiAccessToken,
    connectedAt: metaSettings.connectedAt,
    feedUrl: `${origin.replace(/\/$/, '')}/api/catalog/feed`,
    facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || null,
    loginConfigId: process.env.NEXT_PUBLIC_MBE_CONFIG_ID || null,
  };

  return (
    <AdminClient
      stats={stats}
      products={products}
      lowStockProducts={lowStockProducts}
      orders={ordersWithItems}
      users={users}
      carouselSlides={carouselSlides}
      currentUserId={sessionResult.user.id}
      meta={meta}
      reviews={reviews}
      discounts={discounts}
      retention={retention}
      topProducts={topProducts}
    />
  );
}
