import db from './client';
import { hashPassword } from '../auth/hash';

/**
 * Initializes the SQLite tables if they do not exist and seeds initial data.
 */
export async function initDb() {
  // Create tables using a batch transaction execution
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carousel_slides (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      image_url TEXT NOT NULL,
      link_url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      shipping_address TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meta_settings (
      id TEXT PRIMARY KEY,
      pixel_id TEXT,
      capi_access_token TEXT,
      catalog_id TEXT,
      page_id TEXT,
      business_id TEXT,
      brand_name TEXT,
      site_url TEXT,
      test_event_code TEXT,
      connected_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_subtotal REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      starts_at INTEGER,
      ends_at INTEGER,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'subscribed',
      source TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      created_at INTEGER NOT NULL,
      sent_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS abandoned_carts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      recovered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migration: rebuild `orders` to support guest checkout (nullable user_id)
  // and a full price breakdown. Runs once (guarded by the new `subtotal` column).
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  if (!orderColumns.some((c) => c.name === 'subtotal')) {
    db.pragma('foreign_keys = OFF');
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE orders_new (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_email TEXT,
          guest_name TEXT,
          subtotal REAL NOT NULL DEFAULT 0,
          discount_code TEXT,
          discount_amount REAL NOT NULL DEFAULT 0,
          shipping_amount REAL NOT NULL DEFAULT 0,
          tax_amount REAL NOT NULL DEFAULT 0,
          total_amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          shipping_address TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        INSERT INTO orders_new (id, user_id, subtotal, total_amount, status, shipping_address, created_at)
          SELECT id, user_id, total_amount, total_amount, status, shipping_address, created_at FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
      `);
    });
    rebuild();
    db.pragma('foreign_keys = ON');
    console.log('Migrated orders table (guest checkout + price breakdown)');
  }

  // Ensure a single settings row exists so the marketing dashboard can update it
  const settingsRow = db.prepare("SELECT id FROM meta_settings WHERE id = 'default'").get();
  if (!settingsRow) {
    db.prepare("INSERT INTO meta_settings (id, updated_at) VALUES ('default', ?)").run(Date.now());
  }

  // Migration: add extended profile columns to `users` for existing databases
  // (CREATE TABLE IF NOT EXISTS won't add columns to an already-created table).
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const existingCols = new Set(userColumns.map((c) => c.name));
  const addColumn = (name: string, definition: string) => {
    if (!existingCols.has(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    }
  };
  addColumn('avatar_url', 'TEXT');
  addColumn('phone', 'TEXT');
  addColumn('bio', 'TEXT');
  addColumn('address', 'TEXT');

  // Seed default admin user if not exists
  const adminEmail = 'admin@ecom.com';
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!adminExists) {
    const adminId = 'admin-default-uuid';
    const hash = await hashPassword('adminpassword123');
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, 'Store Admin', adminEmail, hash, 'admin', Date.now());
    console.log('Seeded default admin user: admin@ecom.com / adminpassword123');
  }

  // Seed initial products catalog if empty
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const mockProducts = [
      {
        id: 'p1',
        name: 'AeroPro Wireless Earbuds',
        description: 'Premium active noise-cancelling wireless earbuds with spatial audio, 30-hour battery life, and crystal-clear call quality.',
        price: 129.99,
        stock: 45,
        image_url: '/images/products/earbuds.jpg',
        category: 'Electronics'
      },
      {
        id: 'p2',
        name: 'VividView 4K Projector',
        description: 'Ultra-bright home theater projector featuring true 4K resolution, HDR10 support, and built-in smart TV applications.',
        price: 499.99,
        stock: 15,
        image_url: '/images/products/projector.jpg',
        category: 'Electronics'
      },
      {
        id: 'p3',
        name: 'Quantum Mechanical Keyboard',
        description: 'Compact 75% mechanical keyboard with hot-swappable linear switches, RGB backlighting, and dual-mode wireless connectivity.',
        price: 89.99,
        stock: 30,
        image_url: '/images/products/keyboard.jpg',
        category: 'Electronics'
      },
      {
        id: 'p4',
        name: 'Nordic Minimalist Desk Lamp',
        description: 'Elegant wooden desk lamp with step-less touch dimming, adjustable arm, and soft eye-friendly warm LED light.',
        price: 45.00,
        stock: 50,
        image_url: '/images/products/lamp.jpg',
        category: 'Home & Living'
      },
      {
        id: 'p5',
        name: 'HydroPure Smart Water Bottle',
        description: 'Self-cleaning insulated water bottle with UV-C purification, temperature display, and hydration tracking reminders.',
        price: 35.00,
        stock: 100,
        image_url: '/images/products/bottle.jpg',
        category: 'Home & Living'
      },
      {
        id: 'p6',
        name: 'Urban Canvas Roll-Top Backpack',
        description: 'Water-resistant roll-top backpack featuring a padded 16-inch laptop sleeve, ergonomic straps, and quick-access pockets.',
        price: 75.00,
        stock: 25,
        image_url: '/images/products/backpack.jpg',
        category: 'Fashion & Accessories'
      },
      {
        id: 'p7',
        name: 'Horizon Chrono Leather Watch',
        description: 'Classic chronograph wristwatch with Japanese quartz movement, stainless steel case, and premium full-grain leather strap.',
        price: 199.00,
        stock: 20,
        image_url: '/images/products/watch.jpg',
        category: 'Fashion & Accessories'
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO products (id, name, description, price, stock, image_url, category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Perform inserts in a single transaction for security and atomicity
    const transaction = db.transaction((productsList) => {
      for (const p of productsList) {
        insertStmt.run(p.id, p.name, p.description, p.price, p.stock, p.image_url, p.category, Date.now());
      }
    });

    transaction(mockProducts);
    console.log('Seeded default products catalog');
  }

  // Seed demo product galleries (extra images beyond the primary) if empty.
  const imagesCount = db.prepare('SELECT COUNT(*) as count FROM product_images').get() as { count: number };
  if (imagesCount.count === 0) {
    const galleries: Record<string, string[]> = {
      p1: ['/images/products/earbuds-2.jpg', '/images/products/earbuds-3.jpg'],
      p2: ['/images/products/projector-2.jpg'],
      p3: ['/images/products/keyboard-2.jpg'],
      p7: ['/images/products/watch-2.jpg', '/images/products/watch-3.jpg'],
    };
    const insertImg = db.prepare(`
      INSERT INTO product_images (id, product_id, url, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const imgTx = db.transaction(() => {
      for (const [productId, urls] of Object.entries(galleries)) {
        // Only seed if the product actually exists in this database
        const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
        if (!exists) continue;
        urls.forEach((url, i) => insertImg.run(`${productId}-img-${i + 1}`, productId, url, i + 1, Date.now()));
      }
    });
    imgTx();
    console.log('Seeded demo product galleries');
  }

  // Seed a few approved reviews so product pages show ratings out of the box.
  const reviewCount = db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number };
  if (reviewCount.count === 0) {
    const seedReviews: { product_id: string; author: string; rating: number; title: string; body: string; verified: number }[] = [
      { product_id: 'p1', author: 'Marcus T.', rating: 5, title: 'Incredible sound', body: 'The noise cancelling is genuinely impressive and battery lasts all week. Best earbuds I have owned.', verified: 1 },
      { product_id: 'p1', author: 'Priya S.', rating: 4, title: 'Great value', body: 'Comfortable fit and clear calls. Case is a little glossy but sound quality is excellent.', verified: 1 },
      { product_id: 'p1', author: 'Dan W.', rating: 5, title: 'Worth it', body: 'Spatial audio is a game changer for movies. Highly recommend.', verified: 0 },
      { product_id: 'p2', author: 'Elena R.', rating: 5, title: 'Home cinema sorted', body: 'True 4K is stunning and setup took five minutes. Picture is bright even with some ambient light.', verified: 1 },
      { product_id: 'p2', author: 'Chris P.', rating: 4, title: 'Very good', body: 'Great projector for the price. Built-in apps are handy. Fan is a touch audible in quiet scenes.', verified: 1 },
      { product_id: 'p3', author: 'Sofia M.', rating: 5, title: 'Typist heaven', body: 'Hot-swappable switches and the wireless is rock solid. Build quality feels premium.', verified: 1 },
      { product_id: 'p7', author: 'James L.', rating: 5, title: 'Classy watch', body: 'Looks far more expensive than it is. The leather strap is genuinely nice.', verified: 1 },
      { product_id: 'p4', author: 'Aisha K.', rating: 4, title: 'Lovely lamp', body: 'Warm light is perfect for evenings and the touch dimming works well.', verified: 0 },
    ];
    const insertReview = db.prepare(`
      INSERT INTO reviews (id, product_id, user_id, author_name, rating, title, body, status, verified, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 'approved', ?, ?)
    `);
    const revTx = db.transaction(() => {
      seedReviews.forEach((r, i) => {
        if (!db.prepare('SELECT id FROM products WHERE id = ?').get(r.product_id)) return;
        insertReview.run(`seed-review-${i + 1}`, r.product_id, r.author, r.rating, r.title, r.body, r.verified, Date.now() - i * 86400000);
      });
    });
    revTx();
    console.log('Seeded demo product reviews');
  }

  // Seed demo discount codes if none exist.
  const discountCount = db.prepare('SELECT COUNT(*) as count FROM discounts').get() as { count: number };
  if (discountCount.count === 0) {
    const insertDiscount = db.prepare(`
      INSERT INTO discounts (id, code, type, value, min_subtotal, active, used_count, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 0, ?)
    `);
    const discTx = db.transaction(() => {
      insertDiscount.run('disc-welcome', 'WELCOME10', 'percent', 10, 0, Date.now());
      insertDiscount.run('disc-save15', '15OFF', 'fixed', 15, 75, Date.now());
    });
    discTx();
    console.log('Seeded demo discount codes');
  }

  // Seed default carousel slides catalog if empty
  const slidesCount = db.prepare('SELECT COUNT(*) as count FROM carousel_slides').get() as { count: number };
  if (slidesCount.count === 0) {
    const mockSlides = [
      {
        id: 's1',
        title: 'AeroPro Wireless Earbuds',
        subtitle: 'Experience Sound in High Definition. Premium Active Noise Cancelling.',
        image_url: '/images/products/earbuds.jpg',
        link_url: '/products/p1',
        display_order: 1,
        is_active: 1
      },
      {
        id: 's2',
        title: 'State-of-the-Art Living',
        subtitle: 'Upgrade your space with modern design and smart electronics.',
        image_url: '/images/products/projector.jpg',
        link_url: '/#products',
        display_order: 2,
        is_active: 1
      },
      {
        id: 's3',
        title: 'Horizon Chrono Watch',
        subtitle: 'Premium craftsmanship. Japanese quartz movement & leather strap.',
        image_url: '/images/products/watch.jpg',
        link_url: '/products/p7',
        display_order: 3,
        is_active: 1
      }
    ];

    const insertSlideStmt = db.prepare(`
      INSERT INTO carousel_slides (id, title, subtitle, image_url, link_url, display_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const slideTransaction = db.transaction((slidesList) => {
      for (const s of slidesList) {
        insertSlideStmt.run(s.id, s.title, s.subtitle, s.image_url, s.link_url, s.display_order, s.is_active, Date.now());
      }
    });

    slideTransaction(mockSlides);
    console.log('Seeded default carousel slides catalog');
  }
}
