import sqlite3
import os
from .config import DATABASE_PATH, SCHEMA_PATH

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    # Import here to avoid circular imports at module level
    from werkzeug.security import generate_password_hash

    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = get_db_connection()
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)

    # ── Safe migrations: add new columns if they don't exist yet ──────────────
    cursor = conn.cursor()
    for col, col_def in [('email', 'TEXT'), ('password_hash', 'TEXT')]:
        try:
            cursor.execute(f'ALTER TABLE students ADD COLUMN {col} {col_def};')
            conn.commit()
        except Exception:
            # Column already exists – ignore
            pass

    # ── Seed menu items if empty ───────────────────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM menu_items;")
    count = cursor.fetchone()[0]
    if count == 0:
        initial_items = [
            (1, 'Vada Pav', 20.0, 30, 1, 2, '/images/vada_pav.png', 'Snacks'),
            (2, 'Sandwich', 50.0, 20, 1, 4, '/images/sandwich.png', 'Snacks'),
            (3, 'Misal Pav', 60.0, 15, 1, 3, '/images/misal_pav.png', 'Main Course'),
            (4, 'Tea', 10.0, 50, 1, 1, '/images/tea.png', 'Beverages')
        ]
        cursor.executemany(
            """INSERT INTO menu_items (item_id, name, price, stock, is_available, prep_time_minutes, image_url, category)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?);""",
            initial_items
        )

    # ── Seed students if empty, or add passwords to existing demo students ─────
    cursor.execute("SELECT COUNT(*) FROM students;")
    if cursor.fetchone()[0] == 0:
        demo_students = [
            ('STU101', 'Rahul Sharma', 500.0, '9876543210', 'rahul@college.edu',
             generate_password_hash('student123')),
            ('STU102', 'Priya Patel', 500.0, '9876543211', 'priya@college.edu',
             generate_password_hash('student123')),
            ('STU103', 'Amit Verma', 500.0, '9876543212', 'amit@college.edu',
             generate_password_hash('student123')),
            ('STU104', 'Neha Gupta', 500.0, '9876543213', 'neha@college.edu',
             generate_password_hash('student123')),
        ]
        cursor.executemany(
            "INSERT INTO students (student_id, name, balance, phone, email, password_hash) VALUES (?, ?, ?, ?, ?, ?);",
            demo_students
        )
    else:
        # Update existing demo students that have no password_hash yet
        demo_updates = [
            ('rahul@college.edu', generate_password_hash('student123'), 'STU101'),
            ('priya@college.edu', generate_password_hash('student123'), 'STU102'),
            ('amit@college.edu', generate_password_hash('student123'), 'STU103'),
            ('neha@college.edu', generate_password_hash('student123'), 'STU104'),
        ]
        for email, pw_hash, sid in demo_updates:
            cursor.execute(
                "UPDATE students SET email = COALESCE(NULLIF(email,''), ?), password_hash = COALESCE(NULLIF(password_hash,''), ?) WHERE student_id = ?;",
                (email, pw_hash, sid)
            )

    # ── Seed staff user if empty ───────────────────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM staff_users;")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO staff_users (username, password_hash, role, name) VALUES (?, ?, ?, ?);",
            ('canteen_staff', generate_password_hash('staff123'), 'staff', 'Canteen Manager Ramesh')
        )
    else:
        # Migrate plain-text password to hashed if still plain
        cursor.execute("SELECT password_hash FROM staff_users WHERE username = 'canteen_staff';")
        row = cursor.fetchone()
        if row and row['password_hash'] == 'staff123':
            cursor.execute(
                "UPDATE staff_users SET password_hash = ? WHERE username = 'canteen_staff';",
                (generate_password_hash('staff123'),)
            )

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at", DATABASE_PATH)
