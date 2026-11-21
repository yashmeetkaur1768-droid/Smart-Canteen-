import unittest
import json
import os
import sys

# Add parent directory to path so imports work cleanly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.database import get_db_connection, init_db
from backend.cpp_bridge import bridge

class SmartCanteenBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    # ── Helpers ────────────────────────────────────────────────────────────────

    def get_student_token(self, email='rahul@college.edu', password='student123'):
        """Return a valid student Bearer token."""
        res = self.client.post('/api/auth/login', json={'email': email, 'password': password})
        data = res.get_json()
        return data.get('token', '')

    def get_staff_token(self, username='canteen_staff', password='staff123'):
        """Return a valid staff Bearer token."""
        res = self.client.post('/api/staff/login', json={'username': username, 'password': password})
        data = res.get_json()
        return data.get('token', '')

    def auth_headers(self, token):
        return {'Authorization': f'Bearer {token}'}

    # ── Original 8 tests (updated for auth) ───────────────────────────────────

    def test_01_health_and_cpp_engine(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['cpp_engine_status'], 'ok')

    def test_02_menu_and_inventory(self):
        res = self.client.get('/api/menu')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(len(data['menu']) >= 4)
        names = [item['name'] for item in data['menu']]
        self.assertIn('Vada Pav', names)
        self.assertIn('Sandwich', names)
        self.assertIn('Misal Pav', names)
        self.assertIn('Tea', names)

    def test_03_order_excessive_quantity_rejection(self):
        token = self.get_student_token()
        payload = {
            "student_id": "STU101",  # should be ignored by backend
            "items": [{"item_id": 1, "quantity": 9999}],
            "is_prepaid": False
        }
        res = self.client.post('/api/orders', json=payload, headers=self.auth_headers(token))
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data['status'], 'error')
        self.assertIn('Insufficient stock', data['message'])

    def test_04_place_normal_order_and_inventory_decrease(self):
        token = self.get_student_token()  # STU101
        # Fetch initial stock of Vada Pav (item 1)
        res_menu_before = self.client.get('/api/menu')
        item1_before = next(i for i in res_menu_before.get_json()['menu'] if i['item_id'] == 1)
        stock_before = item1_before['stock']

        payload = {
            "items": [{"item_id": 1, "quantity": 2}],
            "is_prepaid": False
        }
        res = self.client.post('/api/orders', json=payload, headers=self.auth_headers(token))
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        order = data['order']
        self.assertFalse(order['is_prepaid'])
        self.assertEqual(order['total_amount'], 40.0)  # 2 * 20.0
        order_id = order['order_id']

        # Verify stock decreased by 2
        res_menu_after = self.client.get('/api/menu')
        item1_after = next(i for i in res_menu_after.get_json()['menu'] if i['item_id'] == 1)
        self.assertEqual(item1_after['stock'], stock_before - 2)

        # Verify order retrieval
        res_ord = self.client.get(f'/api/orders/{order_id}', headers=self.auth_headers(token))
        self.assertEqual(res_ord.status_code, 200)
        self.assertEqual(res_ord.get_json()['order']['status'], 'Pending')

    def test_05_place_prepaid_priority_order(self):
        # Ensure STU102 has sufficient balance for repeated test runs
        conn = get_db_connection()
        conn.execute("UPDATE students SET balance = 500.0 WHERE student_id = 'STU102';")
        conn.commit()
        conn.close()

        token = self.get_student_token('priya@college.edu', 'student123')  # STU102
        payload = {
            "items": [{"item_id": 2, "quantity": 1}, {"item_id": 4, "quantity": 1}],  # Sandwich (50) + Tea (10) = 60
            "is_prepaid": True
        }
        res = self.client.post('/api/orders', json=payload, headers=self.auth_headers(token))
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        order = data['order']
        self.assertTrue(order['is_prepaid'])
        self.assertEqual(order['total_amount'], 60.0)

    def test_06_cancellation_and_inventory_restoration(self):
        # Place an order specifically to cancel it (as STU103)
        student_token = self.get_student_token('amit@college.edu', 'student123')
        staff_token = self.get_staff_token()

        payload = {
            "items": [{"item_id": 3, "quantity": 1}],  # Misal Pav (60)
            "is_prepaid": False
        }
        res = self.client.post('/api/orders', json=payload, headers=self.auth_headers(student_token))
        self.assertEqual(res.status_code, 201)
        order_id = res.get_json()['order']['order_id']

        # Check stock of item 3 right after ordering
        res_menu = self.client.get('/api/menu')
        item3_mid = next(i for i in res_menu.get_json()['menu'] if i['item_id'] == 3)
        stock_mid = item3_mid['stock']

        # Cancel the order (student token)
        cancel_res = self.client.post(f'/api/orders/{order_id}/cancel',
                                      json={"reason": "Test cancellation"},
                                      headers=self.auth_headers(student_token))
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.get_json()['status'], 'ok')

        # Check stock of item 3 restored by 1
        res_menu_restored = self.client.get('/api/menu')
        item3_restored = next(i for i in res_menu_restored.get_json()['menu'] if i['item_id'] == 3)
        self.assertEqual(item3_restored['stock'], stock_mid + 1)

        # Check cancellation appears in cancellation history (requires staff token)
        canc_res = self.client.get('/api/staff/cancellations', headers=self.auth_headers(staff_token))
        self.assertEqual(canc_res.status_code, 200)
        cancellations = canc_res.get_json()['cancellations']
        cancelled_ids = [c['order_id'] for c in cancellations]
        self.assertIn(order_id, cancelled_ids)

    def test_07_staff_workflow_progression(self):
        # Place new order as STU104
        student_token = self.get_student_token('neha@college.edu', 'student123')
        staff_token = self.get_staff_token()

        payload = {
            "items": [{"item_id": 4, "quantity": 2}],
            "is_prepaid": False
        }
        res = self.client.post('/api/orders', json=payload, headers=self.auth_headers(student_token))
        order_id = res.get_json()['order']['order_id']

        # 1. Start preparation (staff)
        res_start = self.client.post(f'/api/staff/orders/{order_id}/start', headers=self.auth_headers(staff_token))
        self.assertEqual(res_start.status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/orders/{order_id}', headers=self.auth_headers(student_token)).get_json()['order']['status'],
            'Preparing'
        )

        # 2. Cannot cancel while preparing
        cancel_attempt = self.client.post(f'/api/orders/{order_id}/cancel',
                                          json={"reason": "Too late"},
                                          headers=self.auth_headers(student_token))
        self.assertEqual(cancel_attempt.status_code, 400)

        # 3. Mark ready (staff)
        res_ready = self.client.post(f'/api/staff/orders/{order_id}/ready', headers=self.auth_headers(staff_token))
        self.assertEqual(res_ready.status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/orders/{order_id}', headers=self.auth_headers(student_token)).get_json()['order']['status'],
            'Ready'
        )

        # 4. Mark complete (staff)
        res_complete = self.client.post(f'/api/staff/orders/{order_id}/complete', headers=self.auth_headers(staff_token))
        self.assertEqual(res_complete.status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/orders/{order_id}', headers=self.auth_headers(student_token)).get_json()['order']['status'],
            'Completed'
        )

    def test_08_fds_visualizer_state(self):
        staff_token = self.get_staff_token()
        res = self.client.get('/api/staff/fds-visualizer', headers=self.auth_headers(staff_token))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')

        # Ensure all 5 mandatory C++ data structures are present and structured
        self.assertIn('normal_queue', data)
        self.assertIn('priority_queue', data)
        self.assertIn('hash_map', data)
        self.assertIn('stack', data)
        self.assertIn('linked_list', data)
        self.assertIn('operation_logs', data)

        # Verify HashMap contains menu items
        hm = data['hash_map']
        self.assertTrue(len(hm) >= 4)

        # Verify stack contains our cancelled order
        stack = data['stack']
        self.assertTrue(len(stack) >= 1)

        # Verify linked list holds orders
        ll = data['linked_list']
        self.assertTrue(len(ll) >= 1)

        print("\nFDS Visualizer State Verified with C++ Engine Successfully!")

    # ── New auth tests ─────────────────────────────────────────────────────────

    def test_09_student_signup_success(self):
        import time
        unique_email = f'newuser_{int(time.time())}@college.edu'
        res = self.client.post('/api/auth/signup', json={
            'name': 'New Student',
            'email': unique_email,
            'phone': '9123456789',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('token', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['role'], 'student')
        self.assertTrue(data['user']['student_id'].startswith('STU'))

    def test_10_signup_missing_fields(self):
        res = self.client.post('/api/auth/signup', json={
            'name': 'Incomplete',
            'email': 'incomplete@test.com'
            # Missing phone and password
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_11_signup_invalid_email(self):
        res = self.client.post('/api/auth/signup', json={
            'name': 'Bad Email',
            'email': 'notanemail',
            'phone': '9123456789',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data['status'], 'error')
        self.assertIn('email', data['message'].lower())

    def test_12_signup_short_password(self):
        res = self.client.post('/api/auth/signup', json={
            'name': 'Short Pass',
            'email': 'shortpass@college.edu',
            'phone': '9123456789',
            'password': 'abc'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data['status'], 'error')
        self.assertIn('8', data['message'])  # "at least 8 characters"

    def test_13_signup_duplicate_email(self):
        # rahul@college.edu is seeded
        res = self.client.post('/api/auth/signup', json={
            'name': 'Duplicate',
            'email': 'rahul@college.edu',
            'phone': '9111111111',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_14_student_login_by_email(self):
        res = self.client.post('/api/auth/login', json={
            'email': 'rahul@college.edu',
            'password': 'student123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('token', data)
        self.assertEqual(data['user']['student_id'], 'STU101')

    def test_15_student_login_by_student_id(self):
        res = self.client.post('/api/auth/login', json={
            'student_id': 'STU101',
            'password': 'student123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('token', data)

    def test_16_login_wrong_password(self):
        res = self.client.post('/api/auth/login', json={
            'email': 'rahul@college.edu',
            'password': 'wrongpassword'
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_17_missing_token_rejected(self):
        # Attempt to place an order without any token
        res = self.client.post('/api/orders', json={
            'items': [{'item_id': 1, 'quantity': 1}],
            'is_prepaid': False
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_18_staff_login_hashed_password(self):
        res = self.client.post('/api/staff/login', json={
            'username': 'canteen_staff',
            'password': 'staff123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'staff')

    def test_19_student_cannot_access_staff_endpoint(self):
        student_token = self.get_student_token()
        # Student token used on staff dashboard
        res = self.client.get('/api/staff/dashboard', headers=self.auth_headers(student_token))
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_20_student_cannot_view_other_student_orders(self):
        # STU101 places an order
        token_stu101 = self.get_student_token('rahul@college.edu', 'student123')
        place_res = self.client.post('/api/orders',
                                     json={'items': [{'item_id': 1, 'quantity': 1}], 'is_prepaid': False},
                                     headers=self.auth_headers(token_stu101))
        order_id = place_res.get_json()['order']['order_id']

        # STU102 tries to view STU101's order
        token_stu102 = self.get_student_token('priya@college.edu', 'student123')
        res = self.client.get(f'/api/orders/{order_id}', headers=self.auth_headers(token_stu102))
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_21_student_cannot_cancel_other_student_order(self):
        # STU103 places an order
        token_stu103 = self.get_student_token('amit@college.edu', 'student123')
        place_res = self.client.post('/api/orders',
                                     json={'items': [{'item_id': 4, 'quantity': 1}], 'is_prepaid': False},
                                     headers=self.auth_headers(token_stu103))
        order_id = place_res.get_json()['order']['order_id']

        # STU104 tries to cancel STU103's order
        token_stu104 = self.get_student_token('neha@college.edu', 'student123')
        res = self.client.post(f'/api/orders/{order_id}/cancel',
                               json={'reason': 'malicious'},
                               headers=self.auth_headers(token_stu104))
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_22_student_id_in_body_cannot_override_token(self):
        """The student_id in the request body is ignored; token identity is used."""
        token_stu101 = self.get_student_token('rahul@college.edu', 'student123')
        # Pretend to be STU102 in body while using STU101 token
        res = self.client.post('/api/orders', json={
            'student_id': 'STU102',  # should be IGNORED
            'items': [{'item_id': 1, 'quantity': 1}],
            'is_prepaid': False
        }, headers=self.auth_headers(token_stu101))
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')
        # Order must be attributed to STU101, not STU102
        self.assertEqual(data['order']['student_id'], 'STU101')

    def test_23_invalid_malformed_token_rejected(self):
        res = self.client.get('/api/auth/me', headers=self.auth_headers('invalid.garbage.token'))
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_24_logout_and_revoked_token_rejected(self):
        token = self.get_student_token('rahul@college.edu', 'student123')
        # Verify token works
        res_me = self.client.get('/api/auth/me', headers=self.auth_headers(token))
        self.assertEqual(res_me.status_code, 200)

        # Logout
        res_logout = self.client.post('/api/auth/logout', headers=self.auth_headers(token))
        self.assertEqual(res_logout.status_code, 200)
        self.assertEqual(res_logout.get_json()['status'], 'ok')

        # Using the same token now must fail with 401
        res_after = self.client.get('/api/auth/me', headers=self.auth_headers(token))
        self.assertEqual(res_after.status_code, 401)
        self.assertIn('revoked', res_after.get_json()['message'].lower())

    def test_25_staff_denied_access_to_student_ordering(self):
        staff_token = self.get_staff_token()
        res = self.client.post('/api/orders', json={
            'items': [{'item_id': 1, 'quantity': 1}],
            'is_prepaid': False
        }, headers=self.auth_headers(staff_token))
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json()['status'], 'error')

    def test_26_auth_me_student_and_staff(self):
        student_token = self.get_student_token('rahul@college.edu', 'student123')
        res_stu = self.client.get('/api/auth/me', headers=self.auth_headers(student_token))
        self.assertEqual(res_stu.status_code, 200)
        self.assertEqual(res_stu.get_json()['user']['role'], 'student')
        self.assertEqual(res_stu.get_json()['user']['student_id'], 'STU101')

        staff_token = self.get_staff_token()
        res_stf = self.client.get('/api/auth/me', headers=self.auth_headers(staff_token))
        self.assertEqual(res_stf.status_code, 200)
        self.assertEqual(res_stf.get_json()['user']['role'], 'staff')
        self.assertEqual(res_stf.get_json()['user']['username'], 'canteen_staff')

    def test_27_get_student_orders_scoped_to_token(self):
        token_stu101 = self.get_student_token('rahul@college.edu', 'student123')
        # Even if calling /api/students/STU999/orders, it returns STU101's orders
        res = self.client.get('/api/students/STU999/orders', headers=self.auth_headers(token_stu101))
        self.assertEqual(res.status_code, 200)
        orders = res.get_json()['orders']
        for ord_item in orders:
            self.assertEqual(ord_item['student_id'], 'STU101')

        # Also test /api/orders GET
        res_all = self.client.get('/api/orders', headers=self.auth_headers(token_stu101))
        self.assertEqual(res_all.status_code, 200)
        for ord_item in res_all.get_json()['orders']:
            self.assertEqual(ord_item['student_id'], 'STU101')

    def test_28_database_records_survive_migration(self):
        # Trigger init_db again to simulate repeated migrations
        init_db()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM students;")
        self.assertGreaterEqual(cursor.fetchone()[0], 4)
        cursor.execute("SELECT COUNT(*) FROM menu_items;")
        self.assertGreaterEqual(cursor.fetchone()[0], 4)
        conn.close()

if __name__ == '__main__':
    unittest.main()
