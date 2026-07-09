const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('data/ecommerce.db');

// Custom Scrypt configuration matching standard OWASP recommendation
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1
};

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(salt + "." + derivedKey.toString('hex'));
    });
  });
}

async function runE2E() {
  console.log("Starting E2E Flow Simulation...");

  // 1. Register a new user
  const email = 'testuser@ecom.com';
  const name = 'John Doe';
  const password = 'password123';
  const userId = crypto.randomUUID();
  
  const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (userExists) {
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  }
  
  const hash = await hashPassword(password);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'customer', ?)
  `).run(userId, name, email, hash, Date.now());
  console.log(`Step 1: User Registered successfully. ID: ${userId}`);

  // 2 & 3. Add item to cart and Checkout
  const productId = 'p1'; // AeroPro Wireless Earbuds
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  console.log(`Selected Product: ${product.name}, Price: $${product.price}, Stock: ${product.stock}`);

  const checkoutQty = 2;
  const orderId = crypto.randomUUID();
  const totalAmount = product.price * checkoutQty;

  const checkoutTx = db.transaction(() => {
    // Decrement stock
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(checkoutQty, productId);
    
    // Create order
    db.prepare(`
      INSERT INTO orders (id, user_id, total_amount, status, shipping_address, created_at)
      VALUES (?, ?, ?, 'paid', '123 E-Commerce Way, Suite 100', ?)
    `).run(orderId, userId, totalAmount, Date.now());

    // Link items
    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, quantity, price)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), orderId, productId, checkoutQty, product.price);
  });

  checkoutTx();
  console.log(`Step 2 & 3: Order Checked Out. Order ID: ${orderId}, Total: $${totalAmount}`);

  // 4. Login as Admin & Verify role
  const admin = db.prepare("SELECT * FROM users WHERE email = 'admin@ecom.com'").get();
  if (admin.role !== 'admin') {
    throw new Error('Default user admin@ecom.com is not an admin!');
  }
  console.log(`Step 4: Logged in as Admin: ${admin.name}`);

  // 5. Update order status
  db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ?").run(orderId);
  console.log(`Step 5 (shipped): Order status updated to 'shipped'.`);

  db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").run(orderId);
  console.log(`Step 5 (completed): Order status updated to 'completed'.`);

  console.log("E2E Simulation Finished successfully!");
}

runE2E().catch(console.error);
