-- Smart Canteen Database Schema (SQLite)

CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 500.0,
    phone TEXT
);

CREATE TABLE IF NOT EXISTS menu_items (
    item_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_available INTEGER NOT NULL DEFAULT 1,
    prep_time_minutes INTEGER NOT NULL DEFAULT 2,
    image_url TEXT,
    category TEXT DEFAULT 'Snacks'
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES students(student_id),
    student_name TEXT NOT NULL,
    is_prepaid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Preparing, Ready, Completed, Cancelled
    total_amount REAL NOT NULL,
    sequence_number INTEGER NOT NULL,
    estimated_wait_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES menu_items(item_id),
    item_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cancellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id),
    student_id TEXT NOT NULL REFERENCES students(student_id),
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    refund_amount REAL NOT NULL,
    items_summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES menu_items(item_id),
    change_qty INTEGER NOT NULL,
    resulting_stock INTEGER NOT NULL,
    type TEXT NOT NULL, -- ORDER_RESERVE, ORDER_CANCEL_RESTORE, STAFF_RESTOCK, STAFF_ADJUST
    reference_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    name TEXT NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_id);
