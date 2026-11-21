"""
Authentication routes for students (signup / login / logout / me).
Staff login is handled separately in staff_routes.py but follows the same token format.
"""
import re
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from ..database import get_db_connection
from ..auth import generate_token, revoke_token, require_auth

auth_bp = Blueprint('auth', __name__)


def _email_valid(email: str) -> bool:
    return '@' in email and '.' in email.split('@')[-1]


def _phone_valid(phone: str) -> bool:
    return bool(re.fullmatch(r'\d{10}', phone))


# ── POST /api/auth/signup ──────────────────────────────────────────────────────

@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    phone = str(data.get('phone', '')).strip()
    password = str(data.get('password', ''))

    # Validation
    if not all([name, email, phone, password]):
        return jsonify({'status': 'error', 'message': 'All fields (name, email, phone, password) are required.'}), 400
    if not _email_valid(email):
        return jsonify({'status': 'error', 'message': 'Invalid email address.'}), 400
    if not _phone_valid(phone):
        return jsonify({'status': 'error', 'message': 'Phone number must be exactly 10 digits.'}), 400
    if len(password) < 8:
        return jsonify({'status': 'error', 'message': 'Password must be at least 8 characters.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Unique email check
    cursor.execute('SELECT student_id FROM students WHERE email = ?;', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'status': 'error', 'message': 'An account with this email already exists.'}), 409

    # Generate student_id: STU + (max numeric suffix + 1), minimum 101
    cursor.execute("SELECT student_id FROM students ORDER BY student_id DESC;")
    rows = cursor.fetchall()
    max_num = 100
    for row in rows:
        sid = row['student_id']
        if sid.startswith('STU'):
            try:
                num = int(sid[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    student_id = f'STU{max_num + 1}'

    password_hash = generate_password_hash(password)

    try:
        cursor.execute(
            'INSERT INTO students (student_id, name, balance, phone, email, password_hash) VALUES (?, ?, ?, ?, ?, ?);',
            (student_id, name, 500.0, phone, email, password_hash)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'status': 'error', 'message': f'Failed to create account: {str(e)}'}), 500

    conn.close()

    token = generate_token(student_id, 'student')
    return jsonify({
        'status': 'ok',
        'message': 'Account created successfully!',
        'token': token,
        'user': {
            'student_id': student_id,
            'name': name,
            'email': email,
            'phone': phone,
            'balance': 500.0,
            'role': 'student'
        }
    }), 201


# ── POST /api/auth/login ───────────────────────────────────────────────────────

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    identifier = str(data.get('email', data.get('student_id', ''))).strip()
    password = str(data.get('password', ''))

    if not identifier or not password:
        return jsonify({'status': 'error', 'message': 'Email/Student ID and password are required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Try email first, then student_id
    if '@' in identifier:
        cursor.execute(
            'SELECT student_id, name, email, phone, balance, password_hash FROM students WHERE email = ?;',
            (identifier.lower(),)
        )
    else:
        cursor.execute(
            'SELECT student_id, name, email, phone, balance, password_hash FROM students WHERE student_id = ?;',
            (identifier.upper(),)
        )

    student = cursor.fetchone()
    conn.close()

    if not student or not student['password_hash']:
        return jsonify({'status': 'error', 'message': 'Invalid credentials.'}), 401

    if not check_password_hash(student['password_hash'], password):
        return jsonify({'status': 'error', 'message': 'Invalid credentials.'}), 401

    token = generate_token(student['student_id'], 'student')
    return jsonify({
        'status': 'ok',
        'message': 'Login successful',
        'token': token,
        'user': {
            'student_id': student['student_id'],
            'name': student['name'],
            'email': student['email'],
            'phone': student['phone'],
            'balance': float(student['balance']),
            'role': 'student'
        }
    })


# ── POST /api/auth/logout ──────────────────────────────────────────────────────

@auth_bp.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    revoke_token(g.token)
    return jsonify({'status': 'ok', 'message': 'Logged out successfully.'})


# ── GET /api/auth/me ───────────────────────────────────────────────────────────

@auth_bp.route('/api/auth/me', methods=['GET'])
@require_auth
def me():
    role = g.auth_role
    conn = get_db_connection()
    cursor = conn.cursor()

    if role == 'student':
        cursor.execute(
            'SELECT student_id, name, email, phone, balance FROM students WHERE student_id = ?;',
            (g.student_id,)
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({'status': 'error', 'message': 'Student not found.'}), 404
        return jsonify({
            'status': 'ok',
            'user': {
                'student_id': row['student_id'],
                'name': row['name'],
                'email': row['email'],
                'phone': row['phone'],
                'balance': float(row['balance']),
                'role': 'student'
            }
        })
    else:  # staff
        cursor.execute(
            'SELECT username, role, name FROM staff_users WHERE username = ?;',
            (g.staff_username,)
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({'status': 'error', 'message': 'Staff user not found.'}), 404
        return jsonify({
            'status': 'ok',
            'user': {
                'username': row['username'],
                'name': row['name'],
                'role': row['role']
            }
        })

