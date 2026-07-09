import { validateSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import db from "@/lib/db/client";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sessionResult = await validateSession();
  if (!sessionResult) {
    redirect("/login?redirectTo=/profile");
  }

  // Load the full user record (including extended profile fields)
  const user = db.prepare(`
    SELECT id, name, email, role, avatar_url, phone, bio, address, created_at
    FROM users
    WHERE id = ?
  `).get(sessionResult.user.id) as {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url: string | null;
    phone: string | null;
    bio: string | null;
    address: string | null;
    created_at: number;
  };

  // Order history for the user (secure parameter binding)
  const orders = db.prepare(`
    SELECT id, total_amount, status, shipping_address, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(user.id) as any[];

  const ordersWithItems = orders.map((order) => {
    const items = db.prepare(`
      SELECT oi.quantity, oi.price, p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id) as any[];
    return { ...order, items };
  });

  // Account stats
  const totalSpent = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const stats = { orderCount: orders.length, totalSpent };

  return <ProfileClient user={user} orders={ordersWithItems} stats={stats} />;
}
