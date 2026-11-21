from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from ..database import get_db_connection
from ..cpp_bridge import bridge
from ..auth import generate_token, require_staff

staff_bp = Blueprint('staff', __name__)

@staff_bp.route('/api/staff/login', methods=['POST'])
def staff_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, password_hash, role, name FROM staff_users WHERE username = ?;", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'status': 'error', 'message': 'Invalid staff credentials'}), 401

    token = generate_token(user['username'], 'staff')
    return jsonify({
        'status': 'ok',
        'message': 'Login successful',
        'token': token,
        'user': {
            'username': user['username'],
            'role': user['role'],
            'name': user['name']
        }
    })

@staff_bp.route('/api/staff/dashboard', methods=['GET'])
@require_staff
def get_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Aggregate stats
    cursor.execute("SELECT COUNT(*) AS total_orders FROM orders;")
    total_orders = cursor.fetchone()['total_orders']

    cursor.execute("SELECT COUNT(*) AS completed_orders FROM orders WHERE status = 'Completed';")
    completed_orders = cursor.fetchone()['completed_orders']

    cursor.execute("SELECT COUNT(*) AS cancelled_orders FROM orders WHERE status = 'Cancelled';")
    cancelled_orders = cursor.fetchone()['cancelled_orders']

    cursor.execute("SELECT COALESCE(SUM(total_amount), 0) AS total_sales FROM orders WHERE status = 'Completed';")
    total_sales = float(cursor.fetchone()['total_sales'])

    cursor.execute("SELECT COUNT(*) AS active_queue FROM orders WHERE status IN ('Pending', 'Preparing');")
    active_queue = cursor.fetchone()['active_queue']

    # Low stock warnings (stock <= 5)
    cursor.execute("SELECT item_id, name, stock, price FROM menu_items WHERE stock <= 5 ORDER BY stock ASC;")
    low_stock_items = [dict(r) for r in cursor.fetchall()]

    # Orders list
    cursor.execute("""
        SELECT order_id, student_id, student_name, is_prepaid, status, total_amount,
               sequence_number, estimated_wait_minutes, created_at, updated_at
        FROM orders
        ORDER BY 
            CASE status
                WHEN 'Preparing' THEN 1
                WHEN 'Pending' THEN 2
                WHEN 'Ready' THEN 3
                ELSE 4
            END,
            is_prepaid DESC,
            sequence_number ASC;
    """)
    all_orders = []
    for r in cursor.fetchall():
        o = dict(r)
        o['is_prepaid'] = bool(o['is_prepaid'])
        cursor.execute("SELECT item_name, quantity, price, subtotal FROM order_items WHERE order_id = ?;", (o['order_id'],))
        o['items'] = [dict(it) for it in cursor.fetchall()]
        all_orders.append(o)

    conn.close()

    return jsonify({
        'status': 'ok',
        'stats': {
            'total_orders': total_orders,
            'completed_orders': completed_orders,
            'cancelled_orders': cancelled_orders,
            'total_sales': total_sales,
            'active_queue': active_queue,
            'low_stock_count': len(low_stock_items)
        },
        'low_stock_warnings': low_stock_items,
        'orders': all_orders
    })

@staff_bp.route('/api/staff/orders/<int:order_id>/start', methods=['POST'])
@require_staff
def start_order_prep(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT order_id, status FROM orders WHERE order_id = ?;", (order_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Order #{order_id} not found'}), 404

    if order['status'] != 'Pending':
        conn.close()
        return jsonify({'status': 'error', 'message': f"Cannot start preparation: Order is currently '{order['status']}'"}), 400

    cursor.execute("UPDATE orders SET status = 'Preparing', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?;", (order_id,))
    conn.commit()
    conn.close()

    # Inform C++ engine
    try:
        bridge.send_command({"command": "START_PREPARATION", "order_id": order_id})
    except Exception:
        pass

    return jsonify({'status': 'ok', 'message': f'Preparation started for Order #{order_id}'})

@staff_bp.route('/api/staff/orders/<int:order_id>/ready', methods=['POST'])
@require_staff
def ready_order(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT order_id, status FROM orders WHERE order_id = ?;", (order_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Order #{order_id} not found'}), 404

    if order['status'] != 'Preparing':
        conn.close()
        return jsonify({'status': 'error', 'message': f"Cannot mark ready: Order is currently '{order['status']}' (must be 'Preparing')"}), 400

    cursor.execute("UPDATE orders SET status = 'Ready', updated_at = CURRENT_TIMESTAMP, estimated_wait_minutes = 0 WHERE order_id = ?;", (order_id,))
    conn.commit()
    conn.close()

    try:
        bridge.send_command({"command": "READY_ORDER", "order_id": order_id})
    except Exception:
        pass

    return jsonify({'status': 'ok', 'message': f'Order #{order_id} is marked Ready for Pickup'})

@staff_bp.route('/api/staff/orders/<int:order_id>/complete', methods=['POST'])
@require_staff
def complete_order(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT order_id, status FROM orders WHERE order_id = ?;", (order_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Order #{order_id} not found'}), 404

    if order['status'] not in ('Ready', 'Preparing'):
        conn.close()
        return jsonify({'status': 'error', 'message': f"Cannot complete: Order is in status '{order['status']}'"}), 400

    cursor.execute("UPDATE orders SET status = 'Completed', updated_at = CURRENT_TIMESTAMP, estimated_wait_minutes = 0 WHERE order_id = ?;", (order_id,))
    conn.commit()
    conn.close()

    try:
        bridge.send_command({"command": "COMPLETE_ORDER", "order_id": order_id})
    except Exception:
        pass

    return jsonify({'status': 'ok', 'message': f'Order #{order_id} completed successfully'})

@staff_bp.route('/api/staff/menu/<int:item_id>', methods=['PATCH'])
@require_staff
def update_menu_item(item_id):
    data = request.get_json() or {}
    new_price = data.get('price')
    new_name = data.get('name')
    prep_time = data.get('prep_time_minutes')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT item_id, price, name, prep_time_minutes, stock FROM menu_items WHERE item_id = ?;", (item_id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Item #{item_id} not found'}), 404

    updates = []
    params = []
    if new_price is not None:
        p = float(new_price)
        if p < 0:
            conn.close()
            return jsonify({'status': 'error', 'message': 'Price cannot be negative'}), 400
        updates.append("price = ?")
        params.append(p)

    if new_name is not None and str(new_name).strip():
        updates.append("name = ?")
        params.append(str(new_name).strip())

    if prep_time is not None:
        pt = int(prep_time)
        if pt > 0:
            updates.append("prep_time_minutes = ?")
            params.append(pt)

    if not updates:
        conn.close()
        return jsonify({'status': 'error', 'message': 'No valid updates provided'}), 400

    params.append(item_id)
    cursor.execute(f"UPDATE menu_items SET {', '.join(updates)} WHERE item_id = ?;", params)
    conn.commit()

    # Fetch updated item
    cursor.execute("SELECT item_id, name, price, stock, is_available, prep_time_minutes FROM menu_items WHERE item_id = ?;", (item_id,))
    updated_item = dict(cursor.fetchone())
    conn.close()

    # Sync to C++ HashMap
    try:
        bridge.send_command({
            "command": "UPDATE_INVENTORY",
            "item_id": item_id,
            "price": float(updated_item['price']),
            "prep_time_minutes": int(updated_item['prep_time_minutes'])
        })
    except Exception:
        pass

    return jsonify({'status': 'ok', 'message': f"Item #{item_id} updated", 'item': updated_item})

@staff_bp.route('/api/staff/inventory/<int:item_id>', methods=['PATCH'])
@require_staff
def update_inventory(item_id):
    data = request.get_json() or {}
    restock_qty = data.get('restock_quantity')
    set_stock = data.get('set_stock')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT item_id, name, stock FROM menu_items WHERE item_id = ?;", (item_id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Item #{item_id} not found'}), 404

    current_stock = int(item['stock'])

    if set_stock is not None:
        new_stock = int(set_stock)
        if new_stock < 0:
            conn.close()
            return jsonify({'status': 'error', 'message': 'Inventory cannot be negative'}), 400
        delta = new_stock - current_stock
        tx_type = 'STAFF_ADJUST'
    elif restock_qty is not None:
        delta = int(restock_qty)
        new_stock = current_stock + delta
        if new_stock < 0:
            conn.close()
            return jsonify({'status': 'error', 'message': 'Resulting stock cannot be negative'}), 400
        tx_type = 'STAFF_RESTOCK'
    else:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Please provide restock_quantity or set_stock'}), 400

    cursor.execute("""
        UPDATE menu_items
        SET stock = ?,
            is_available = CASE WHEN ? > 0 THEN 1 ELSE 0 END
        WHERE item_id = ?;
    """, (new_stock, new_stock, item_id))

    cursor.execute("""
        INSERT INTO inventory_transactions (item_id, change_qty, resulting_stock, type, reference_id)
        VALUES (?, ?, ?, ?, 'STAFF_UPDATE');
    """, (item_id, delta, new_stock, tx_type))

    conn.commit()
    conn.close()

    # Sync to C++ HashMap
    try:
        bridge.send_command({
            "command": "UPDATE_INVENTORY",
            "item_id": item_id,
            "stock": new_stock
        })
    except Exception:
        pass

    return jsonify({
        'status': 'ok',
        'message': f"Stock updated for '{item['name']}' to {new_stock} portions",
        'item_id': item_id,
        'new_stock': new_stock
    })

@staff_bp.route('/api/staff/cancellations', methods=['GET'])
@require_staff
def get_cancellations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.order_id, c.student_id, s.name as student_name,
               c.cancelled_at, c.reason, c.refund_amount, c.items_summary
        FROM cancellations c
        LEFT JOIN students s ON c.student_id = s.student_id
        ORDER BY c.id DESC;
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'status': 'ok', 'cancellations': rows})

@staff_bp.route('/api/staff/fds-visualizer', methods=['GET'])
@require_staff
def get_fds_visualizer():
    """
    Returns the real in-memory state of all 5 C++ Data Structures directly from the C++ Engine:
    1. NormalQueue (FIFO)
    2. PriorityOrderQueue (Min-Heap)
    3. MenuHashMap (std::unordered_map)
    4. CancellationStack (LIFO)
    5. OrderHistoryLinkedList (Singly Linked List)
    Plus Live Operation Event Log
    """
    try:
        vis_state = bridge.send_command({"command": "GET_VISUALIZER_STATE"})
        return jsonify(vis_state)
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'C++ Engine communication error: {str(e)}'}), 500
