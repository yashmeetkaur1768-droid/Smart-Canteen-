from flask import Blueprint, request, jsonify, g
from ..database import get_db_connection
from ..cpp_bridge import bridge
from ..auth import require_student

order_bp = Blueprint('orders', __name__)

@order_bp.route('/api/orders', methods=['POST'])
@require_student
def place_order():
    data = request.get_json() or {}
    # student_id comes from the auth token, NOT the request body (body value is ignored)
    student_id = g.student_id
    items_input = data.get('items', [])
    is_prepaid = bool(data.get('is_prepaid', False))

    if not items_input or not isinstance(items_input, list):
        return jsonify({'status': 'error', 'message': 'Order must contain at least one valid item'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Verify student exists
        cursor.execute("SELECT student_id, name, balance FROM students WHERE student_id = ?;", (student_id,))
        student = cursor.fetchone()
        if not student:
            conn.close()
            return jsonify({'status': 'error', 'message': f'Student {student_id} not found'}), 404

        student_name = student['name']
        student_balance = float(student['balance'])

        # 2. Begin transaction for stock reservation and order placement
        conn.execute("BEGIN IMMEDIATE;")

        total_amount = 0.0
        total_prep_time = 0
        validated_items = []

        for req_item in items_input:
            item_id = int(req_item.get('item_id', 0))
            quantity = int(req_item.get('quantity', 0))

            if quantity <= 0:
                conn.rollback()
                conn.close()
                return jsonify({'status': 'error', 'message': f'Invalid quantity {quantity} for item ID {item_id}'}), 400

            cursor.execute("SELECT item_id, name, price, stock, is_available, prep_time_minutes FROM menu_items WHERE item_id = ?;", (item_id,))
            menu_row = cursor.fetchone()

            if not menu_row:
                conn.rollback()
                conn.close()
                return jsonify({'status': 'error', 'message': f'Item ID {item_id} does not exist in menu'}), 404

            current_stock = int(menu_row['stock'])
            if current_stock < quantity:
                conn.rollback()
                conn.close()
                return jsonify({
                    'status': 'error',
                    'message': f"Insufficient stock for '{menu_row['name']}'. Requested: {quantity}, Available: {current_stock}"
                }), 400

            price = float(menu_row['price'])
            subtotal = price * quantity
            total_amount += subtotal
            total_prep_time += int(menu_row['prep_time_minutes']) * quantity

            validated_items.append({
                'item_id': item_id,
                'name': menu_row['name'],
                'price': price,
                'quantity': quantity,
                'subtotal': subtotal,
                'prep_time_minutes': int(menu_row['prep_time_minutes'])
            })

        # Check balance if prepaid
        if is_prepaid and student_balance < total_amount:
            conn.rollback()
            conn.close()
            return jsonify({
                'status': 'error',
                'message': f"Insufficient wallet balance. Required: ₹{total_amount:.2f}, Available: ₹{student_balance:.2f}"
            }), 400

        # Monotonically increasing sequence number across orders
        cursor.execute("SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM orders;")
        next_sequence = cursor.fetchone()['next_seq']

        # Insert order record
        cursor.execute("""
            INSERT INTO orders (student_id, student_name, is_prepaid, status, total_amount, sequence_number, estimated_wait_minutes)
            VALUES (?, ?, ?, 'Pending', ?, ?, 0);
        """, (student_id, student_name, 1 if is_prepaid else 0, total_amount, next_sequence))
        order_id = cursor.lastrowid

        # Insert order items and deduct inventory
        for vi in validated_items:
            cursor.execute("""
                INSERT INTO order_items (order_id, item_id, item_name, price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (order_id, vi['item_id'], vi['name'], vi['price'], vi['quantity'], vi['subtotal']))

            # Deduct stock
            cursor.execute("""
                UPDATE menu_items
                SET stock = stock - ?,
                    is_available = CASE WHEN stock - ? > 0 THEN 1 ELSE 0 END
                WHERE item_id = ?;
            """, (vi['quantity'], vi['quantity'], vi['item_id']))

            # Get resulting stock
            cursor.execute("SELECT stock FROM menu_items WHERE item_id = ?;", (vi['item_id'],))
            resulting_stock = cursor.fetchone()['stock']

            cursor.execute("""
                INSERT INTO inventory_transactions (item_id, change_qty, resulting_stock, type, reference_id)
                VALUES (?, ?, ?, 'ORDER_RESERVE', ?);
            """, (vi['item_id'], -vi['quantity'], resulting_stock, str(order_id)))

        # Deduct wallet balance if prepaid
        if is_prepaid:
            cursor.execute("""
                UPDATE students SET balance = balance - ? WHERE student_id = ?;
            """, (total_amount, student_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'status': 'error', 'message': f'Order transaction failed: {str(e)}'}), 500

    conn.close()

    # 3. Synchronize with C++ FDS Engine
    try:
        # Enqueue in C++ Engine
        cmd_enqueue = {
            "command": "ENQUEUE_ORDER",
            "order_id": order_id,
            "student_id": student_id,
            "student_name": student_name,
            "is_prepaid": is_prepaid,
            "total_amount": total_amount,
            "sequence_number": next_sequence,
            "prep_time_minutes": total_prep_time
        }
        cpp_resp = bridge.send_command(cmd_enqueue)

        # Update in-memory stock in C++ HashMap for each item
        for vi in validated_items:
            bridge.send_command({
                "command": "UPDATE_INVENTORY",
                "item_id": vi['item_id'],
                "delta_stock": -vi['quantity']
            })

        queue_position = cpp_resp.get('queue_position', 1)
        estimated_wait = cpp_resp.get('estimated_wait_minutes', 5)

        # Update estimated wait time in DB
        conn = get_db_connection()
        conn.execute("UPDATE orders SET estimated_wait_minutes = ? WHERE order_id = ?;", (estimated_wait, order_id))
        conn.commit()
        conn.close()

    except Exception as e:
        queue_position = 1
        estimated_wait = max(2, total_prep_time)

    return jsonify({
        'status': 'ok',
        'message': f"Order #{order_id} placed successfully!",
        'order': {
            'order_id': order_id,
            'student_id': student_id,
            'student_name': student_name,
            'is_prepaid': is_prepaid,
            'total_amount': total_amount,
            'status': 'Pending',
            'sequence_number': next_sequence,
            'queue_position': queue_position,
            'estimated_wait_minutes': estimated_wait,
            'items': validated_items
        }
    }), 201

@order_bp.route('/api/orders/<int:order_id>', methods=['GET'])
@require_student
def get_order_status(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT order_id, student_id, student_name, is_prepaid, status, total_amount,
               sequence_number, estimated_wait_minutes, created_at, updated_at
        FROM orders
        WHERE order_id = ?;
    """, (order_id,))
    order_row = cursor.fetchone()

    if not order_row:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Order #{order_id} not found'}), 404

    # Verify this order belongs to the authenticated student
    if order_row['student_id'] != g.student_id:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Access denied: this order does not belong to you.'}), 403

    cursor.execute("""
        SELECT item_id, item_name, price, quantity, subtotal
        FROM order_items
        WHERE order_id = ?;
    """, (order_id,))
    items = [dict(r) for r in cursor.fetchall()]
    conn.close()

    order_dict = dict(order_row)
    order_dict['items'] = items
    order_dict['is_prepaid'] = bool(order_dict['is_prepaid'])

    # Query live estimate from C++ Engine
    try:
        est_resp = bridge.send_command({
            "command": "GET_QUEUE_ESTIMATE",
            "order_id": order_id
        })
        if est_resp.get('status') == 'ok':
            order_dict['queue_position'] = est_resp.get('queue_position', 1)
            order_dict['estimated_wait_minutes'] = est_resp.get('estimated_wait_minutes', order_dict['estimated_wait_minutes'])
            order_dict['orders_ahead'] = est_resp.get('orders_ahead', 0)
    except Exception:
        order_dict['queue_position'] = 1

    return jsonify({'status': 'ok', 'order': order_dict})

@order_bp.route('/api/orders', methods=['GET'])
@order_bp.route('/api/students/<student_id>/orders', methods=['GET'])
@require_student
def get_student_orders(student_id=None):
    # Always use the authenticated student's ID, ignore the URL param
    actual_student_id = g.student_id

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT order_id, student_id, student_name, is_prepaid, status, total_amount,
               sequence_number, estimated_wait_minutes, created_at, updated_at
        FROM orders
        WHERE student_id = ?
        ORDER BY order_id DESC;
    """, (actual_student_id,))
    orders_rows = cursor.fetchall()

    orders_list = []
    for r in orders_rows:
        o = dict(r)
        o['is_prepaid'] = bool(o['is_prepaid'])
        cursor.execute("SELECT item_id, item_name, price, quantity, subtotal FROM order_items WHERE order_id = ?;", (o['order_id'],))
        o['items'] = [dict(it) for it in cursor.fetchall()]

        # Query live estimate if active
        if o['status'] in ('Pending', 'Preparing'):
            try:
                est = bridge.send_command({"command": "GET_QUEUE_ESTIMATE", "order_id": o['order_id']})
                if est.get('status') == 'ok':
                    o['queue_position'] = est.get('queue_position', 1)
                    o['estimated_wait_minutes'] = est.get('estimated_wait_minutes', o['estimated_wait_minutes'])
            except Exception:
                pass
        orders_list.append(o)

    conn.close()
    return jsonify({'status': 'ok', 'orders': orders_list})

@order_bp.route('/api/orders/<int:order_id>/cancel', methods=['POST'])
@require_student
def cancel_order(order_id):
    data = request.get_json() or {}
    reason = data.get('reason', 'Cancelled by student').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        conn.execute("BEGIN IMMEDIATE;")

        cursor.execute("SELECT order_id, student_id, is_prepaid, status, total_amount FROM orders WHERE order_id = ?;", (order_id,))
        order = cursor.fetchone()

        if not order:
            conn.rollback()
            conn.close()
            return jsonify({'status': 'error', 'message': f'Order #{order_id} not found'}), 404

        # Verify ownership
        if order['student_id'] != g.student_id:
            conn.rollback()
            conn.close()
            return jsonify({'status': 'error', 'message': 'Access denied: this order does not belong to you.'}), 403

        current_status = order['status']
        if current_status != 'Pending':
            conn.rollback()
            conn.close()
            if current_status == 'Preparing':
                return jsonify({'status': 'error', 'message': 'Cannot cancel: Canteen staff have already started cooking your order.'}), 400
            elif current_status in ('Ready', 'Completed'):
                return jsonify({'status': 'error', 'message': f'Cannot cancel: Order is already {current_status}.'}), 400
            elif current_status == 'Cancelled':
                return jsonify({'status': 'error', 'message': 'Order is already cancelled.'}), 400
            else:
                return jsonify({'status': 'error', 'message': f'Order cannot be cancelled in state {current_status}.'}), 400

        student_id = order['student_id']
        is_prepaid = bool(order['is_prepaid'])
        total_amount = float(order['total_amount'])

        # 1. Fetch order items to restore stock
        cursor.execute("SELECT item_id, item_name, quantity, subtotal FROM order_items WHERE order_id = ?;", (order_id,))
        order_items = cursor.fetchall()
        items_summary_parts = []

        for it in order_items:
            items_summary_parts.append(f"{it['quantity']}x {it['item_name']}")
            # Restore stock
            cursor.execute("""
                UPDATE menu_items
                SET stock = stock + ?,
                    is_available = 1
                WHERE item_id = ?;
            """, (it['quantity'], it['item_id']))

            # Resulting stock
            cursor.execute("SELECT stock FROM menu_items WHERE item_id = ?;", (it['item_id'],))
            resulting_stock = cursor.fetchone()['stock']

            cursor.execute("""
                INSERT INTO inventory_transactions (item_id, change_qty, resulting_stock, type, reference_id)
                VALUES (?, ?, ?, 'ORDER_CANCEL_RESTORE', ?);
            """, (it['item_id'], it['quantity'], resulting_stock, str(order_id)))

        items_summary = ", ".join(items_summary_parts)

        # 2. Refund balance if prepaid
        if is_prepaid:
            cursor.execute("UPDATE students SET balance = balance + ? WHERE student_id = ?;", (total_amount, student_id))

        # 3. Update order status
        cursor.execute("UPDATE orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?;", (order_id,))

        # 4. Insert into cancellations table
        cursor.execute("""
            INSERT INTO cancellations (order_id, student_id, reason, refund_amount, items_summary)
            VALUES (?, ?, ?, ?, ?);
        """, (order_id, student_id, reason, total_amount if is_prepaid else 0.0, items_summary))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'status': 'error', 'message': f'Cancellation failed: {str(e)}'}), 500

    conn.close()

    # 5. Push cancellation to C++ Engine (Stack, Queue removal, HashMap stock restore)
    try:
        bridge.send_command({
            "command": "CANCEL_ORDER",
            "order_id": order_id,
            "student_id": student_id,
            "reason": reason,
            "refund_amount": total_amount if is_prepaid else 0.0,
            "items_summary": items_summary
        })

        for it in order_items:
            bridge.send_command({
                "command": "UPDATE_INVENTORY",
                "item_id": it['item_id'],
                "delta_stock": it['quantity']
            })
    except Exception as e:
        pass

    return jsonify({
        'status': 'ok',
        'message': f"Order #{order_id} cancelled successfully. Inventory restored.",
        'order_id': order_id,
        'refund_amount': total_amount if is_prepaid else 0.0
    })
