# Smart Canteen — Queue Management & Ordering System

A full-stack college canteen ordering and queue management system with deterministic wait-time estimation, token-based authentication, and real-time inventory tracking.

---

## 1. System Overview

**Smart Canteen** replaces counter congestion with a structured, transparent ordering and queue-tracking workflow. The platform combines:
- **React Frontend**: A clean, responsive web application for students and canteen staff.
- **Python / Flask Backend**: RESTful API layer with token authentication, route authorization, and ACID transactions.
- **C++ Queue Engine**: High-performance core data structures for FIFO queueing, min-heap priority scheduling, hash map inventory lookups, LIFO cancellation auditing, and multi-station wait-time estimation.
- **SQLite Database**: Persistent relational storage with atomic transactions and automated migrations.

---

## 2. Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                 React Frontend (Vite)                       │
│  - Student Portal: Menu, Cart, Live Tracker, My Orders      │
│  - Staff Dashboard: Kitchen Queue, Stock, Cancellations     │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST APIs (JSON over HTTP + Bearer Token)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Flask Backend                        │
│  - Authentication & Role Authorization (Student / Staff)    │
│  - ACID Transactions (BEGIN IMMEDIATE, COMMIT, ROLLBACK)    │
│  - Subprocess Bridge (`cpp_bridge.py`)                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │ SQL Queries                  │ Stdio Pipe (JSON-RPC)
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      SQLite Database         │ │      C++ Queue Engine      │
│ - students, orders,          │ │ - NormalQueue (FIFO)       │
│   order_items, menu_items,   │ │ - PriorityQueue (Min-Heap) │
│   cancellations, staff_users │ │ - MenuHashMap (Lookup)     │
│ - Persistent Source of Truth │ │ - CancellationStack (LIFO) │
└──────────────────────────────┘ │ - Singly Linked List (Hist)│
                                 │ - Queue Estimator Algorithm│
                                 └────────────────────────────┘
```

- **Frontend**: React 18, Vite, Lucide Icons, Custom CSS Design System.
- **Backend**: Python 3.10+, Flask 3.0, Flask-CORS, Werkzeug (password hashing), itsdangerous (signed session tokens), Gunicorn.
- **Core Algorithms Engine**: Native C++ (MinGW GCC / Linux GCC, `-std=c++14 -O2`), persistent subprocess communication via stdio JSON-RPC.
- **Database**: SQLite3 (`database/canteen.db`) with schema defined in `database/schema.sql`.

---

## 3. C++ Queue Engine & Python Bridge

The core scheduling engine (`cpp/engine.cpp`) runs as an isolated, compiled native process connected to the Flask backend via `backend/cpp_bridge.py`:
- **NormalQueue**: First-In-First-Out queue for standard orders.
- **PriorityOrderQueue**: Binary Min-Heap ordering prepaid orders ahead of standard orders with sequence-number tie-breaking.
- **MenuHashMap**: Fast $O(1)$ memory lookup for stock levels and item prep times.
- **CancellationStack**: Last-In-First-Out stack keeping an immediate audit log of recently cancelled orders.
- **OrderHistoryLinkedList**: Singly linked list maintaining chronological order placement throughout the day.
- **Queue Estimator**: Calculates deterministic wait times across $S = 2$ parallel kitchen stations:

$$\text{Estimated Wait} = \left\lceil \frac{W_{\text{active}} + W_{\text{priority\_ahead}} + W_{\text{normal\_ahead}} + W_{\text{target}}}{S} \right\rceil$$

---

## 4. Authentication & Security

### Password Security
- All student and staff passwords are encrypted and verified using `werkzeug.security.generate_password_hash` and `check_password_hash` (scrypt algorithm).
- Plain-text passwords and password hashes are never returned across API responses.

### Token-Based Sessions
- Sessions use cryptographic signed tokens generated via `itsdangerous.URLSafeTimedSerializer`.
- Tokens contain student/staff identity, role, and a unique cryptographic nonce (`jti`).
- Passed via standard HTTP header: `Authorization: Bearer <token>`.
- Token expiration: 7 days.
- Safe revocation mechanism: Active sessions are revoked upon calling `POST /api/auth/logout`.

### Role-Based Access Control
- `@require_student`: Protects student actions (placing orders, cancelling orders, viewing personal order history).
- `@require_staff`: Protects kitchen controls (starting prep, marking ready, completing orders, modifying menu prices/stock, viewing cancellation audits).
- **Order Ownership**: All order operations verify that `order.student_id == g.student_id`. Students cannot inspect or cancel another student's order by changing the ID in the URL or payload.

---

## 5. Seeded Demo Accounts & Credentials

### Students (Each pre-seeded with ₹500.00 wallet balance)
| Student ID | Student Name | Email | Password |
|---|---|---|---|
| `STU101` | Rahul Sharma | `rahul@college.edu` | `student123` |
| `STU102` | Priya Patel | `priya@college.edu` | `student123` |
| `STU103` | Amit Verma | `amit@college.edu` | `student123` |
| `STU104` | Neha Gupta | `neha@college.edu` | `student123` |

Students can log in using either their **Email** or their **Student ID** (e.g., `STU101`).

### Canteen Staff
| Username | Role | Password |
|---|---|---|
| `canteen_staff` | Canteen Manager (Staff) | `staff123` |

---

## 6. API Endpoint Reference

### Public Endpoints
- `GET /api/health` — System status and C++ engine connectivity check.
- `GET /api/menu` — Current menu items, pricing, and stock portions.
- `GET /api/queue` — Public live queue counts (priority pending, normal pending).

### Authentication Endpoints
- `POST /api/auth/signup` — Register new student account (`name`, `email`, `phone`, `password`). Generates unique `STU###` ID and seeds ₹500 balance.
- `POST /api/auth/login` — Student login via email or student ID. Returns `{token, user}`.
- `POST /api/auth/logout` — Revokes active session token.
- `GET /api/auth/me` — Fetches profile and current balance for authenticated user.
- `POST /api/staff/login` — Staff portal login via username and password. Returns `{token, user}`.

### Student Ordering Endpoints (Require Student Token)
- `POST /api/orders` — Place new order (`items`, `is_prepaid`).
- `GET /api/orders` — Retrieve order history for the authenticated student.
- `GET /api/orders/<int:order_id>` — Retrieve live queue position, wait estimate, and status for student's own order.
- `POST /api/orders/<int:order_id>/cancel` — Cancel pending order and restore inventory/refund wallet.

### Staff Endpoints (Require Staff Token)
- `GET /api/staff/dashboard` — Aggregated orders, revenue, and queue statistics.
- `POST /api/staff/orders/<int:order_id>/start` — Transition order from Pending to Preparing.
- `POST /api/staff/orders/<int:order_id>/ready` — Mark order ready for counter pickup.
- `POST /api/staff/orders/<int:order_id>/complete` — Finalize counter pickup.
- `PATCH /api/staff/menu/<int:item_id>` — Update item price and availability.
- `PATCH /api/staff/inventory/<int:item_id>` — Restock portions.
- `GET /api/staff/cancellations` — Review cancelled order audit log.
- `GET /api/staff/fds-visualizer` — Direct memory inspector for C++ engine structures.

---

## 7. How to Run Locally (Windows)

### Prerequisites
- Python 3.10+
- Node.js 18+
- MinGW GCC (`g++`) with C++14 support

### 1-Click Startup Scripts
1. **Compile C++ Engine** (if `cpp/engine.exe` is not already compiled):
   ```cmd
   build_cpp.bat
   ```
2. **Start Backend**:
   ```cmd
   run_backend.bat
   ```
   *Runs Flask on http://127.0.0.1:5000*
3. **Start Frontend**:
   ```cmd
   run_frontend.bat
   ```
   *Runs React dev server on http://localhost:5173*

---

## 8. Automated Testing

Run the full automated test suite:
```powershell
# 1. C++ Engine Self-Test
.\cpp\engine.exe --test

# 2. Python Backend Integration & Security Tests (28 tests)
python -m unittest backend/test_backend.py

# 3. Frontend Production Build Check
cd frontend; npm.cmd run build; cd ..

# 4. Live End-to-End Workflow Test (with live server running)
python test_e2e_live.py
```

All 28 backend unit & integration tests verify:
- Student signup (valid input, missing fields, invalid email, short password, duplicate email)
- Student and staff login with hashed password verification
- Session restoration via `/api/auth/me`
- Token revocation and logout enforcement
- Route authorization: student blocked from staff views, staff blocked from student ordering
- Order ownership: students cannot view or cancel other students' orders
- Request body student ID injection prevention
- Transactional inventory reservation, stock decrements, and cancellation restoration
- Dynamic queue estimations via the C++ bridge

---

## 9. Production Deployment

### Architectural Requirement
The C++ queue engine runs as a long-lived stateful subprocess communicating over stdio JSON-RPC with the Python process. Because of this, **the backend cannot run on serverless functions** (e.g. AWS Lambda or Vercel Serverless Functions). It must run as a single long-lived containerized process with **exactly 1 Gunicorn worker** (`--workers 1 --threads 8`) to maintain a single, synchronized in-memory C++ engine state.

### Backend Deployment on Render (via Docker)

1. **Push your repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete smart canteen production setup"
   git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
   git branch -M main
   git push -u origin main
   ```
2. **Create Web Service on Render**:
   - Log in to [render.com](https://render.com) and click **New +** &rarr; **Web Service**.
   - Connect your GitHub repository.
   - Select **Docker** as the Runtime.
   - Choose the **Free** instance type (or Starter for persistent disks).
   - Set the Health Check Path to: `/api/health`.
3. **Configure Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `SECRET_KEY` | *(Click "Generate" or enter a 32+ character random secret)* | Cryptographic session signing key. **The app will fail loudly at startup if missing.** |
   | `ALLOWED_ORIGINS` | `https://<YOUR-VERCEL-APP>.vercel.app` | Comma-separated list of allowed frontend origins for CORS. |
   | `DEBUG` | `false` | Disables debug mode and enforces production security. |
   | `DATABASE_PATH` | `/data/canteen.db` *(with disk)* or `/app/database/canteen.db` *(without disk)* | Path to SQLite database file. |

4. **Persistent Disk & Free-Tier Behavior**:
   > [!IMPORTANT]
   > - **Free Tier Note**: On the Render Free plan, the service enters sleep mode after 15 minutes of inactivity. When a new request arrives, it wakes up within ~50 seconds.
   > - **Storage**: On the Free plan, container storage is ephemeral (the SQLite database resets to its seeded demo state on container redeploy or sleep restart).
   > - **Persistent Storage (Optional)**: Attaching a Render Persistent Disk (`/data`, 1 GB) preserves order history and wallet balances permanently across redeploys (requires a Render paid instance, $7/mo).

---

### Frontend Deployment on Vercel

1. **Configure API Proxy in `frontend/vercel.json`**:
   Open [`frontend/vercel.json`](file:///frontend/vercel.json) and replace `<YOUR-RENDER-BACKEND-SERVICE>` with your actual Render service subdomain:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://smart-canteen-backend.onrender.com/api/$1"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
2. **Deploy to Vercel**:
   - Log in to [vercel.com](https://vercel.com) and click **Add New** &rarr; **Project**.
   - Import your GitHub repository.
   - Set **Root Directory** to `frontend`.
   - **Framework Preset**: Vite (detected automatically).
   - Click **Deploy**.
3. **Verify Connection**:
   - Open your deployed Vercel URL.
   - Open browser DevTools &rarr; Network tab. All calls to `/api/*` are transparently rewritten by Vercel to your Render backend without browser CORS friction.
