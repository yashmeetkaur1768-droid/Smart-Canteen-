from flask import Blueprint, jsonify
from ..database import get_db_connection

menu_bp = Blueprint('menu', __name__)

@menu_bp.route('/api/menu', methods=['GET'])
def get_menu():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT item_id, name, price, stock, is_available, prep_time_minutes, image_url, category
        FROM menu_items
        ORDER BY item_id ASC;
    """)
    rows = cursor.fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'item_id': r['item_id'],
            'name': r['name'],
            'price': float(r['price']),
            'stock': int(r['stock']),
            'is_available': bool(r['is_available'] and r['stock'] > 0),
            'prep_time_minutes': int(r['prep_time_minutes']),
            'image_url': r['image_url'],
            'category': r['category']
        })
    return jsonify({'status': 'ok', 'menu': items})

@menu_bp.route('/api/inventory', methods=['GET'])
def get_inventory():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT item_id, name, price, stock, is_available, prep_time_minutes, category
        FROM menu_items
        ORDER BY item_id ASC;
    """)
    rows = cursor.fetchall()
    conn.close()

    inv = []
    for r in rows:
        inv.append({
            'item_id': r['item_id'],
            'name': r['name'],
            'price': float(r['price']),
            'stock': int(r['stock']),
            'is_available': bool(r['is_available'] and r['stock'] > 0),
            'status': 'Out of Stock' if r['stock'] <= 0 else ('Low Stock' if r['stock'] <= 5 else 'In Stock'),
            'prep_time_minutes': int(r['prep_time_minutes']),
            'category': r['category']
        })
    return jsonify({'status': 'ok', 'inventory': inv})
