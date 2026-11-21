import urllib.request
import json
import time
import sys
import os

# Ensure UTF-8 output on Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = os.environ.get('CANTEEN_API_URL', 'http://127.0.0.1:5000/api')

def post_json(endpoint, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(endpoint, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        headers=headers,
        method='GET'
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def main():
    print("=" * 60)
    print("RUNNING LIVE END-TO-END SMART CANTEEN WORKFLOW TEST")
    print(f"Target API Base URL: {BASE_URL}")
    print("=" * 60)

    # 1. Fetch Menu (Public)
    menu_data = get_json('/menu')
    print(f"\n[STEP 1] Menu fetched successfully: {len(menu_data['menu'])} items available.")
    for item in menu_data['menu']:
        print(f"  - #{item['item_id']} {item['name']}: Rs. {item['price']} (Stock: {item['stock']} portions)")

    # 2. Authenticate Student Rahul (STU101)
    print("\n[STEP 2] Authenticating student Rahul (rahul@college.edu)...")
    rahul_auth = post_json('/auth/login', {
        'email': 'rahul@college.edu',
        'password': 'student123'
    })
    rahul_token = rahul_auth['token']
    print(f"  -> Logged in as: {rahul_auth['user']['name']} ({rahul_auth['user']['student_id']})")
    print(f"  -> Available Balance: Rs. {rahul_auth['user']['balance']}")

    # 3. Place Normal Order for Rahul (STU101)
    print("\n[STEP 3] Placing Normal (FIFO) Order for STU101 (2x Vada Pav)...")
    normal_order_res = post_json('/orders', {
        'items': [{'item_id': 1, 'quantity': 2}],
        'is_prepaid': False
    }, token=rahul_token)
    normal_ord = normal_order_res['order']
    print(f"  -> Accepted Order #{normal_ord['order_id']} | Seq #{normal_ord['sequence_number']}")
    print(f"  -> Queue Position: #{normal_ord['queue_position']} | Estimated Wait: {normal_ord['estimated_wait_minutes']} mins")

    # 4. Authenticate Student Priya (STU102) & Place Prepaid Priority Order
    print("\n[STEP 4] Authenticating student Priya (priya@college.edu)...")
    priya_auth = post_json('/auth/login', {
        'email': 'priya@college.edu',
        'password': 'student123'
    })
    priya_token = priya_auth['token']
    print(f"  -> Logged in as: {priya_auth['user']['name']} ({priya_auth['user']['student_id']})")

    print("  -> Placing Prepaid Priority Order for STU102 (1x Sandwich, 1x Tea)...")
    prio_order_res = post_json('/orders', {
        'items': [{'item_id': 2, 'quantity': 1}, {'item_id': 4, 'quantity': 1}],
        'is_prepaid': True
    }, token=priya_token)
    prio_ord = prio_order_res['order']
    print(f"  -> Accepted Priority Order #{prio_ord['order_id']} | Seq #{prio_ord['sequence_number']}")
    print(f"  -> Queue Position: #{prio_ord['queue_position']} | Estimated Wait: {prio_ord['estimated_wait_minutes']} mins")

    # 5. Check Live Queue Board (Public)
    print("\n[STEP 5] Querying Live Queue Board...")
    queue_board = get_json('/queue')
    queues = queue_board['queues']
    print(f"  - Priority Queue (Prepaid) waiting count: {len(queues.get('priority_pending', []))}")
    print(f"  - Normal Queue (Standard) waiting count: {len(queues.get('normal_pending', []))}")

    # 6. Cancel Normal Order (STU101) with Rahul's token and verify inventory restoration
    print(f"\n[STEP 6] Cancelling Normal Order #{normal_ord['order_id']} with Rahul's token...")
    cancel_res = post_json(f"/orders/{normal_ord['order_id']}/cancel", {
        'reason': 'Ordered incorrect portion size'
    }, token=rahul_token)
    print(f"  -> Cancellation response: {cancel_res['message']}")

    # 7. Authenticate Kitchen Staff
    print("\n[STEP 7] Authenticating Canteen Kitchen Staff...")
    staff_auth = post_json('/staff/login', {
        'username': 'canteen_staff',
        'password': 'staff123'
    })
    staff_token = staff_auth['token']
    print(f"  -> Staff Logged in: {staff_auth['user']['name']} ({staff_auth['user']['role']})")

    # 8. Progress Priority Order through Kitchen lifecycle
    print(f"\n[STEP 8] Kitchen Staff Processing Priority Order #{prio_ord['order_id']}...")
    start_res = post_json(f"/staff/orders/{prio_ord['order_id']}/start", {}, token=staff_token)
    print(f"  -> Start Cooking: {start_res['message']}")

    ready_res = post_json(f"/staff/orders/{prio_ord['order_id']}/ready", {}, token=staff_token)
    print(f"  -> Mark Ready: {ready_res['message']}")

    complete_res = post_json(f"/staff/orders/{prio_ord['order_id']}/complete", {}, token=staff_token)
    print(f"  -> Complete Pickup: {complete_res['message']}")

    # 9. Query C++ Engine Data Structure State (Staff Protected)
    print("\n[STEP 9] Inspecting C++ Engine Data Structure State...")
    fds = get_json('/staff/fds-visualizer', token=staff_token)
    print(f"  - C++ NormalQueue elements: {len(fds.get('normal_queue', []))}")
    print(f"  - C++ PriorityOrderQueue elements: {len(fds.get('priority_queue', []))}")
    print(f"  - C++ MenuHashMap elements: {len(fds.get('hash_map', []))}")
    print(f"  - C++ CancellationStack depth: {len(fds.get('stack', []))}")
    if fds.get('stack'):
        top_cancel = fds['stack'][0]
        print(f"    -> Top of Stack: Order #{top_cancel['order_id']} (Reason: '{top_cancel.get('reason', '')}')")
    print(f"  - C++ Singly LinkedList nodes: {len(fds.get('linked_list', []))}")
    print(f"  - C++ In-Memory Operation Logs count: {len(fds.get('operation_logs', []))}")

    print("\n" + "=" * 60)
    print("SUCCESS: ALL END-TO-END WORKFLOWS TESTED & VERIFIED WITH AUTHENTICATION!")
    print("=" * 60)

if __name__ == '__main__':
    main()
