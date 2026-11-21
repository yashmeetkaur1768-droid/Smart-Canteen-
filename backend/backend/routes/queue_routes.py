from flask import Blueprint, jsonify
from ..database import get_db_connection
from ..cpp_bridge import bridge

queue_bp = Blueprint('queue', __name__)

@queue_bp.route('/api/queue', methods=['GET'])
def get_live_queue():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Active pending and preparing orders
    cursor.execute("""
        SELECT o.order_id, o.student_id, o.student_name, o.is_prepaid, o.status,
               o.total_amount, o.sequence_number, o.estimated_wait_minutes, o.created_at
        FROM orders o
        WHERE o.status IN ('Pending', 'Preparing', 'Ready')
        ORDER BY o.is_prepaid DESC, o.sequence_number ASC;
    """)
    rows = cursor.fetchall()

    orders_by_status = {
        'priority_pending': [],
        'normal_pending': [],
        'preparing': [],
        'ready': []
    }

    for r in rows:
        ord_dict = dict(r)
        ord_dict['is_prepaid'] = bool(ord_dict['is_prepaid'])

        cursor.execute("SELECT item_name, quantity FROM order_items WHERE order_id = ?;", (ord_dict['order_id'],))
        ord_dict['items'] = [dict(it) for it in cursor.fetchall()]

        if ord_dict['status'] == 'Preparing':
            orders_by_status['preparing'].append(ord_dict)
        elif ord_dict['status'] == 'Ready':
            orders_by_status['ready'].append(ord_dict)
        elif ord_dict['is_prepaid']:
            orders_by_status['priority_pending'].append(ord_dict)
        else:
            orders_by_status['normal_pending'].append(ord_dict)

    conn.close()

    # Get live counts from C++ Engine
    stats = {}
    try:
        vis = bridge.send_command({"command": "GET_VISUALIZER_STATE"})
        if vis.get('status') == 'ok':
            stats = vis.get('stats', {})
    except Exception:
        pass

    return jsonify({
        'status': 'ok',
        'queues': orders_by_status,
        'stats': stats
    })
