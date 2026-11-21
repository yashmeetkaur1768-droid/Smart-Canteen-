import subprocess
import json
import threading
import os
import logging
from .config import CPP_ENGINE_EXECUTABLE

logger = logging.getLogger("cpp_bridge")
logger.setLevel(logging.INFO)

class CppEngineBridge:
    def __init__(self, executable_path=CPP_ENGINE_EXECUTABLE):
        self.executable_path = executable_path
        self.process = None
        self.lock = threading.Lock()
        self._ensure_process_running()

    def _ensure_process_running(self):
        if not os.path.exists(self.executable_path):
            raise FileNotFoundError(f"C++ Engine executable not found at: {self.executable_path}. Please compile cpp/engine.cpp first.")

        if self.process is None or self.process.poll() is not None:
            logger.info("Spawning C++ FDS Engine daemon: %s", self.executable_path)
            self.process = subprocess.Popen(
                [self.executable_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )

    def send_command(self, command_dict):
        with self.lock:
            try:
                self._ensure_process_running()
                cmd_line = json.dumps(command_dict) + "\n"
                self.process.stdin.write(cmd_line)
                self.process.stdin.flush()

                response_line = self.process.stdout.readline()
                if not response_line:
                    raise IOError("C++ Engine process closed stdout unexpectedly")

                return json.loads(response_line.strip())
            except Exception as e:
                logger.error("Error communicating with C++ engine: %s. Attempting restart...", e)
                try:
                    if self.process:
                        self.process.kill()
                except Exception:
                    pass
                self.process = None
                self._ensure_process_running()
                # Retry once after re-spawning
                cmd_line = json.dumps(command_dict) + "\n"
                self.process.stdin.write(cmd_line)
                self.process.stdin.flush()
                response_line = self.process.stdout.readline()
                return json.loads(response_line.strip())

    def sync_with_db(self, conn):
        """
        Rehydrates in-memory C++ data structures (Queue, PriorityQueue, HashMap, Stack, LinkedList)
        from SQLite persistent store.
        """
        logger.info("Synchronizing C++ data structures with SQLite...")
        # 1. Reset in-memory C++ structures
        self.send_command({"command": "SYNC_DATABASE"})

        cursor = conn.cursor()

        # 2. Rehydrate Menu HashMap (std::unordered_map)
        cursor.execute("SELECT item_id, name, price, stock, is_available, prep_time_minutes, category FROM menu_items;")
        items = cursor.fetchall()
        for item in items:
            self.send_command({
                "command": "UPDATE_INVENTORY",
                "item_id": item['item_id'],
                "name": item['name'],
                "price": float(item['price']),
                "stock": int(item['stock']),
                "prep_time_minutes": int(item['prep_time_minutes']),
                "category": item['category']
            })

        # 3. Rehydrate Orders into Linked List, Queue, and Priority Queue
        cursor.execute("""
            SELECT order_id, student_id, student_name, is_prepaid, status, total_amount,
                   sequence_number, estimated_wait_minutes, created_at
            FROM orders
            ORDER BY order_id ASC;
        """)
        orders = cursor.fetchall()
        for ord_row in orders:
            # Calculate total prep time from items
            cursor.execute("""
                SELECT SUM(m.prep_time_minutes * oi.quantity) as total_prep
                FROM order_items oi
                JOIN menu_items m ON oi.item_id = m.item_id
                WHERE oi.order_id = ?;
            """, (ord_row['order_id'],))
            prep_row = cursor.fetchone()
            total_prep = prep_row['total_prep'] if prep_row and prep_row['total_prep'] else 3

            cmd_enqueue = {
                "command": "ENQUEUE_ORDER",
                "order_id": ord_row['order_id'],
                "student_id": ord_row['student_id'],
                "student_name": ord_row['student_name'],
                "is_prepaid": bool(ord_row['is_prepaid']),
                "total_amount": float(ord_row['total_amount']),
                "sequence_number": int(ord_row['sequence_number']),
                "prep_time_minutes": int(total_prep),
                "created_at": str(ord_row['created_at'])
            }
            self.send_command(cmd_enqueue)

            # Advance status in C++ engine if order is already Preparing, Ready, Completed, or Cancelled
            status = ord_row['status']
            if status == 'Preparing':
                self.send_command({"command": "START_PREPARATION", "order_id": ord_row['order_id']})
            elif status == 'Ready':
                self.send_command({"command": "START_PREPARATION", "order_id": ord_row['order_id']})
                self.send_command({"command": "READY_ORDER", "order_id": ord_row['order_id']})
            elif status == 'Completed':
                self.send_command({"command": "START_PREPARATION", "order_id": ord_row['order_id']})
                self.send_command({"command": "READY_ORDER", "order_id": ord_row['order_id']})
                self.send_command({"command": "COMPLETE_ORDER", "order_id": ord_row['order_id']})
            elif status == 'Cancelled':
                # Get cancellation details
                cursor.execute("SELECT reason, refund_amount, items_summary FROM cancellations WHERE order_id = ?;", (ord_row['order_id'],))
                c_row = cursor.fetchone()
                reason = c_row['reason'] if c_row else "Order cancelled"
                refund = float(c_row['refund_amount']) if c_row else float(ord_row['total_amount'])
                summary = c_row['items_summary'] if c_row else ""
                self.send_command({
                    "command": "CANCEL_ORDER",
                    "order_id": ord_row['order_id'],
                    "student_id": ord_row['student_id'],
                    "reason": reason,
                    "refund_amount": refund,
                    "items_summary": summary
                })

        logger.info("C++ FDS Engine successfully synchronized with SQLite database.")

# Global singleton instance
bridge = CppEngineBridge()
