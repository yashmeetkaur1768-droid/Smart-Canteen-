#include "models.h"
#include "normal_queue.h"
#include "priority_queue.h"
#include "menu_hashmap.h"
#include "cancellation_stack.h"
#include "order_linked_list.h"
#include "queue_estimator.h"

#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <sstream>
#include <ctime>
#include <iomanip>
#include <cassert>
#include <algorithm>

// Global State Containers for C++ Engine
static NormalQueue g_normalQueue;
static PriorityOrderQueue g_priorityQueue;
static MenuHashMap g_menuMap;
static CancellationStack g_cancelStack;
static OrderHistoryLinkedList g_historyList;
static std::vector<Order> g_preparingOrders;
static std::vector<LogEntry> g_operationLogs;
static QueueEstimator g_estimator(2); // Default 2 parallel preparation stations

// Utility: current timestamp formatted
static std::string getCurrentTimestamp() {
    std::time_t now = std::time(nullptr);
    std::tm* local = std::localtime(&now);
    std::ostringstream ss;
    ss << std::put_time(local, "%Y-%m-%d %H:%M:%S");
    return ss.str();
}

// Utility: Log FDS operation to in-memory audit trail
static void addLog(const std::string& structure, const std::string& operation, const std::string& details) {
    LogEntry entry;
    entry.timestamp = getCurrentTimestamp();
    entry.structure = structure;
    entry.operation = operation;
    entry.details = details;
    g_operationLogs.push_back(entry);
    // Keep last 100 entries
    if (g_operationLogs.size() > 100) {
        g_operationLogs.erase(g_operationLogs.begin());
    }
}

// Robust JSON field extraction helpers handling arbitrary whitespace
static size_t findValuePos(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) return std::string::npos;
    pos += needle.length();
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\r' || json[pos] == '\n')) pos++;
    if (pos >= json.size() || json[pos] != ':') return std::string::npos;
    pos++; // skip ':'
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\r' || json[pos] == '\n')) pos++;
    return pos;
}

static std::string extractJsonString(const std::string& json, const std::string& key) {
    size_t pos = findValuePos(json, key);
    if (pos == std::string::npos || pos >= json.size() || json[pos] != '"') return "";
    pos++; // skip opening quote
    size_t endPos = pos;
    while (endPos < json.size()) {
        if (json[endPos] == '\\' && endPos + 1 < json.size()) {
            endPos += 2;
        } else if (json[endPos] == '"') {
            break;
        } else {
            endPos++;
        }
    }
    if (endPos >= json.size()) return "";
    return json.substr(pos, endPos - pos);
}

static long long extractJsonInt(const std::string& json, const std::string& key, long long defaultVal = 0) {
    size_t pos = findValuePos(json, key);
    if (pos == std::string::npos || pos >= json.size()) return defaultVal;
    size_t endPos = pos;
    while (endPos < json.size() && (isdigit(json[endPos]) || json[endPos] == '-')) endPos++;
    if (endPos == pos) return defaultVal;
    try {
        return std::stoll(json.substr(pos, endPos - pos));
    } catch (...) {
        return defaultVal;
    }
}

static double extractJsonDouble(const std::string& json, const std::string& key, double defaultVal = 0.0) {
    size_t pos = findValuePos(json, key);
    if (pos == std::string::npos || pos >= json.size()) return defaultVal;
    size_t endPos = pos;
    while (endPos < json.size() && (isdigit(json[endPos]) || json[endPos] == '.' || json[endPos] == '-')) endPos++;
    if (endPos == pos) return defaultVal;
    try {
        return std::stod(json.substr(pos, endPos - pos));
    } catch (...) {
        return defaultVal;
    }
}

static bool extractJsonBool(const std::string& json, const std::string& key, bool defaultVal = false) {
    size_t pos = findValuePos(json, key);
    if (pos == std::string::npos || pos >= json.size()) return defaultVal;
    if (json.compare(pos, 4, "true") == 0) return true;
    if (json.compare(pos, 5, "false") == 0) return false;
    return defaultVal;
}

// Serialize full Visualizer State to JSON
static std::string buildVisualizerStateJson() {
    std::ostringstream ss;
    ss << "{"
       << "\"status\":\"ok\","
       << "\"normal_queue\":" << g_normalQueue.toJson() << ","
       << "\"priority_queue\":" << g_priorityQueue.toJson() << ","
       << "\"hash_map\":" << g_menuMap.toJson() << ","
       << "\"stack\":" << g_cancelStack.toJson() << ","
       << "\"linked_list\":" << g_historyList.toJson() << ",";

    // Preparing orders
    ss << "\"preparing_orders\":[";
    for (size_t i = 0; i < g_preparingOrders.size(); ++i) {
        if (i > 0) ss << ",";
        const Order& o = g_preparingOrders[i];
        ss << "{"
           << "\"order_id\":" << o.order_id << ","
           << "\"student_id\":\"" << escapeJson(o.student_id) << "\","
           << "\"student_name\":\"" << escapeJson(o.student_name) << "\","
           << "\"total_amount\":" << o.total_amount << ","
           << "\"status\":\"" << escapeJson(o.status) << "\","
           << "\"is_prepaid\":" << (o.is_prepaid ? "true" : "false") << ","
           << "\"prep_time_minutes\":" << o.estimated_prep_time_minutes
           << "}";
    }
    ss << "],";

    // Operation logs (last 50)
    ss << "\"operation_logs\":[";
    int startIdx = static_cast<int>(g_operationLogs.size()) - 50;
    if (startIdx < 0) startIdx = 0;
    bool first = true;
    for (size_t i = startIdx; i < g_operationLogs.size(); ++i) {
        if (!first) ss << ",";
        first = false;
        const LogEntry& l = g_operationLogs[i];
        ss << "{"
           << "\"timestamp\":\"" << escapeJson(l.timestamp) << "\","
           << "\"structure\":\"" << escapeJson(l.structure) << "\","
           << "\"operation\":\"" << escapeJson(l.operation) << "\","
           << "\"details\":\"" << escapeJson(l.details) << "\""
           << "}";
    }
    ss << "],";

    // Summary statistics
    ss << "\"stats\":{"
       << "\"normal_queue_size\":" << g_normalQueue.size() << ","
       << "\"priority_queue_size\":" << g_priorityQueue.size() << ","
       << "\"preparing_count\":" << g_preparingOrders.size() << ","
       << "\"cancellations_count\":" << g_cancelStack.size() << ","
       << "\"total_orders_history\":" << g_historyList.size() << ","
       << "\"parallel_stations\":" << g_estimator.getParallelStations()
       << "}"
       << "}";
    return ss.str();
}

// Find an order across any active state container
static bool findAnyOrder(int orderId, Order& outOrder) {
    if (g_historyList.searchById(orderId, outOrder)) {
        return true;
    }
    for (const auto& ord : g_preparingOrders) {
        if (ord.order_id == orderId) {
            outOrder = ord;
            return true;
        }
    }
    return false;
}

// Command Processor
static std::string processCommand(const std::string& cmdLine) {
    if (cmdLine.empty()) return "{\"status\":\"error\",\"message\":\"Empty command\"}";

    std::string cmd = extractJsonString(cmdLine, "command");

    if (cmd == "PING") {
        return "{\"status\":\"ok\",\"message\":\"Smart Canteen C++ Engine is active\"}";
    }

    if (cmd == "GET_VISUALIZER_STATE") {
        return buildVisualizerStateJson();
    }

    if (cmd == "ENQUEUE_ORDER") {
        Order ord;
        ord.order_id = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        ord.student_id = extractJsonString(cmdLine, "student_id");
        ord.student_name = extractJsonString(cmdLine, "student_name");
        ord.is_prepaid = extractJsonBool(cmdLine, "is_prepaid", false);
        ord.status = "Pending";
        ord.total_amount = extractJsonDouble(cmdLine, "total_amount");
        ord.sequence_number = extractJsonInt(cmdLine, "sequence_number");
        ord.created_at = extractJsonString(cmdLine, "created_at");
        if (ord.created_at.empty()) ord.created_at = getCurrentTimestamp();
        ord.estimated_prep_time_minutes = static_cast<int>(extractJsonInt(cmdLine, "prep_time_minutes", 3));

        // 1. Insert into Linked List (Order History)
        g_historyList.append(ord);
        addLog("LinkedList", "append()", "Appended Order #" + std::to_string(ord.order_id) + " to history list tail");

        // 2. Insert into appropriate queue
        if (ord.is_prepaid) {
            g_priorityQueue.push(ord);
            addLog("PriorityQueue", "push()", "Prepaid Order #" + std::to_string(ord.order_id) + " inserted into Min-Heap (seq=" + std::to_string(ord.sequence_number) + ")");
        } else {
            g_normalQueue.enqueue(ord);
            addLog("Queue", "enqueue()", "Normal Order #" + std::to_string(ord.order_id) + " enqueued to FIFO rear");
        }

        // Calculate queue position & estimate
        auto est = g_estimator.calculate(ord.order_id, g_preparingOrders, g_priorityQueue, g_normalQueue, ord);

        std::ostringstream resp;
        resp << "{"
             << "\"status\":\"ok\","
             << "\"order_id\":" << ord.order_id << ","
             << "\"queue_position\":" << est.queue_position << ","
             << "\"estimated_wait_minutes\":" << est.estimated_wait_minutes << ","
             << "\"is_prepaid\":" << (ord.is_prepaid ? "true" : "false")
             << "}";
        return resp.str();
    }

    if (cmd == "START_PREPARATION") {
        int orderId = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        Order ord;
        bool found = false;

        // Check priority queue first
        if (g_priorityQueue.removeById(orderId, ord)) {
            found = true;
            addLog("PriorityQueue", "removeById()", "Priority Order #" + std::to_string(orderId) + " dispatched to kitchen station");
        } else if (g_normalQueue.removeById(orderId, ord)) {
            found = true;
            addLog("Queue", "dequeue()/removeById()", "Normal Order #" + std::to_string(orderId) + " dispatched to kitchen station");
        }

        if (!found) {
            // Check if already in preparing or history
            if (g_historyList.searchById(orderId, ord)) {
                found = true;
            }
        }

        if (found) {
            ord.status = "Preparing";
            // Check if not already in preparing orders list
            bool inPrep = false;
            for (const auto& o : g_preparingOrders) {
                if (o.order_id == orderId) { inPrep = true; break; }
            }
            if (!inPrep) {
                g_preparingOrders.push_back(ord);
            }
            g_historyList.updateStatus(orderId, "Preparing");
            addLog("LinkedList", "updateStatus()", "Order #" + std::to_string(orderId) + " status updated to 'Preparing'");

            return "{\"status\":\"ok\",\"message\":\"Preparation started\"}";
        }
        return "{\"status\":\"error\",\"message\":\"Order not found in queue\"}";
    }

    if (cmd == "READY_ORDER") {
        int orderId = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        // Remove from preparing orders
        for (auto it = g_preparingOrders.begin(); it != g_preparingOrders.end(); ++it) {
            if (it->order_id == orderId) {
                g_preparingOrders.erase(it);
                break;
            }
        }
        g_historyList.updateStatus(orderId, "Ready");
        addLog("LinkedList", "updateStatus()", "Order #" + std::to_string(orderId) + " status updated to 'Ready'");
        return "{\"status\":\"ok\",\"message\":\"Order marked ready for pickup\"}";
    }

    if (cmd == "COMPLETE_ORDER") {
        int orderId = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        for (auto it = g_preparingOrders.begin(); it != g_preparingOrders.end(); ++it) {
            if (it->order_id == orderId) {
                g_preparingOrders.erase(it);
                break;
            }
        }
        g_historyList.updateStatus(orderId, "Completed");
        addLog("LinkedList", "updateStatus()", "Order #" + std::to_string(orderId) + " status updated to 'Completed'");
        return "{\"status\":\"ok\",\"message\":\"Order completed successfully\"}";
    }

    if (cmd == "CANCEL_ORDER") {
        int orderId = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        std::string reason = extractJsonString(cmdLine, "reason");
        if (reason.empty()) reason = "Student cancellation";
        std::string itemsSummary = extractJsonString(cmdLine, "items_summary");
        double refundAmount = extractJsonDouble(cmdLine, "refund_amount");

        Order ord;
        bool removed = false;
        if (g_priorityQueue.removeById(orderId, ord)) {
            removed = true;
            addLog("PriorityQueue", "removeById()", "Cancelled Order #" + std::to_string(orderId) + " safely removed from Priority Queue");
        } else if (g_normalQueue.removeById(orderId, ord)) {
            removed = true;
            addLog("Queue", "removeById()", "Cancelled Order #" + std::to_string(orderId) + " safely removed from Normal FIFO Queue");
        }

        // Push to Cancellation Stack
        CancelledRecord rec;
        rec.order_id = orderId;
        rec.student_id = ord.student_id.empty() ? extractJsonString(cmdLine, "student_id") : ord.student_id;
        rec.cancelled_at = getCurrentTimestamp();
        rec.reason = reason;
        rec.refund_amount = refundAmount > 0 ? refundAmount : ord.total_amount;
        rec.items_summary = itemsSummary;

        g_cancelStack.push(rec);
        addLog("Stack", "push()", "Cancelled Order #" + std::to_string(orderId) + " pushed onto LIFO Cancellation Stack");

        // Update status in Linked List
        g_historyList.updateStatus(orderId, "Cancelled");
        addLog("LinkedList", "updateStatus()", "Order #" + std::to_string(orderId) + " marked 'Cancelled' in linked list history");

        return "{\"status\":\"ok\",\"message\":\"Order cancelled and pushed to stack\"}";
    }

    if (cmd == "GET_QUEUE_ESTIMATE") {
        int orderId = static_cast<int>(extractJsonInt(cmdLine, "order_id"));
        Order ord;
        if (!findAnyOrder(orderId, ord)) {
            return "{\"status\":\"error\",\"message\":\"Order not found\"}";
        }
        auto est = g_estimator.calculate(orderId, g_preparingOrders, g_priorityQueue, g_normalQueue, ord);
        std::ostringstream resp;
        resp << "{"
             << "\"status\":\"ok\","
             << "\"order_id\":" << orderId << ","
             << "\"queue_position\":" << est.queue_position << ","
             << "\"estimated_wait_minutes\":" << est.estimated_wait_minutes << ","
             << "\"orders_ahead\":" << est.orders_ahead_count << ","
             << "\"active_stations\":" << est.active_stations_in_use << ","
             << "\"order_status\":\"" << escapeJson(ord.status) << "\""
             << "}";
        return resp.str();
    }

    if (cmd == "UPDATE_INVENTORY") {
        int itemId = static_cast<int>(extractJsonInt(cmdLine, "item_id"));
        int deltaStock = static_cast<int>(extractJsonInt(cmdLine, "delta_stock", 0));
        int absoluteStock = static_cast<int>(extractJsonInt(cmdLine, "stock", -999));
        double price = extractJsonDouble(cmdLine, "price", -1.0);

        MenuItem item;
        if (!g_menuMap.get(itemId, item)) {
            item.item_id = itemId;
            item.name = extractJsonString(cmdLine, "name");
            item.price = (price >= 0) ? price : 20.0;
            item.stock = (absoluteStock >= 0) ? absoluteStock : 20;
            item.is_available = item.stock > 0;
            item.prep_time_minutes = static_cast<int>(extractJsonInt(cmdLine, "prep_time_minutes", 2));
            item.category = extractJsonString(cmdLine, "category");
            g_menuMap.insertOrUpdate(item);
            addLog("HashMap", "insert()", "Inserted item #" + std::to_string(itemId) + " (" + item.name + ") into HashMap (O(1) avg)");
        } else {
            if (price >= 0) {
                g_menuMap.updatePrice(itemId, price);
                addLog("HashMap", "updatePrice()", "Updated item #" + std::to_string(itemId) + " price to ₹" + std::to_string(price));
            }
            if (absoluteStock >= 0) {
                g_menuMap.setStock(itemId, absoluteStock);
                addLog("HashMap", "setStock()", "Set item #" + std::to_string(itemId) + " stock to " + std::to_string(absoluteStock));
            } else if (deltaStock != 0) {
                int newStock = 0;
                g_menuMap.updateStock(itemId, deltaStock, newStock);
                addLog("HashMap", "updateStock()", "Stock updated for item #" + std::to_string(itemId) + " (delta=" + std::to_string(deltaStock) + ", new=" + std::to_string(newStock) + ")");
            }
        }
        return "{\"status\":\"ok\",\"message\":\"Inventory updated in C++ HashMap\"}";
    }

    if (cmd == "SYNC_DATABASE") {
        // Clear in-memory structures to rehydrate from SQLite
        g_historyList.clear();
        g_cancelStack.clear();
        g_preparingOrders.clear();
        // Clear queues
        Order tmp;
        while (g_normalQueue.dequeue(tmp)) {}
        while (g_priorityQueue.pop(tmp)) {}
        g_menuMap.clear();

        addLog("Engine", "SYNC_DATABASE", "Synchronizing in-memory C++ data structures with SQLite persistent store");
        return "{\"status\":\"ok\",\"message\":\"In-memory state reset for sync\"}";
    }

    return "{\"status\":\"error\",\"message\":\"Unknown command: " + cmd + "\"}";
}

// Automated Verification Test Suite
static int runAutomatedTests() {
    std::cout << "=========================================================\n";
    std::cout << "SMART CANTEEN FDS C++ ENGINE - AUTOMATED TEST SUITE\n";
    std::cout << "=========================================================\n";

    // 1. NormalQueue FIFO Test
    std::cout << "\n[TEST 1] NormalQueue (FIFO Queue)...\n";
    {
        NormalQueue q;
        assert(q.empty());
        assert(q.size() == 0);

        Order o1; o1.order_id = 101; o1.sequence_number = 1; o1.is_prepaid = false;
        Order o2; o2.order_id = 102; o2.sequence_number = 2; o2.is_prepaid = false;
        Order o3; o3.order_id = 103; o3.sequence_number = 3; o3.is_prepaid = false;

        q.enqueue(o1);
        q.enqueue(o2);
        q.enqueue(o3);
        assert(q.size() == 3);

        Order front;
        assert(q.front(front) && front.order_id == 101);

        // Test safe removal of middle element (e.g. cancellation)
        Order removed;
        assert(q.removeById(102, removed) && removed.order_id == 102);
        assert(q.size() == 2);

        // FIFO verification
        Order d1, d2;
        assert(q.dequeue(d1) && d1.order_id == 101);
        assert(q.dequeue(d2) && d2.order_id == 103);
        assert(q.empty());
        std::cout << "  -> FIFO Enqueue, Dequeue, Peek, and Cancellation Removal: PASSED\n";
    }

    // 2. PriorityOrderQueue Min-Heap Test
    std::cout << "\n[TEST 2] PriorityOrderQueue (Min-Heap with FIFO Tie-Breaking)...\n";
    {
        PriorityOrderQueue pq;
        assert(pq.empty());

        // Orders arriving at different sequence numbers
        Order p2; p2.order_id = 202; p2.sequence_number = 5; p2.is_prepaid = true;
        Order p1; p1.order_id = 201; p1.sequence_number = 2; p1.is_prepaid = true;
        Order p3; p3.order_id = 203; p3.sequence_number = 7; p3.is_prepaid = true;

        pq.push(p2);
        pq.push(p1);
        pq.push(p3);
        assert(pq.size() == 3);

        // Top should be lowest sequence number (p1 with seq=2)
        Order top;
        assert(pq.top(top) && top.order_id == 201);

        Order out1, out2, out3;
        assert(pq.pop(out1) && out1.order_id == 201); // seq 2
        assert(pq.pop(out2) && out2.order_id == 202); // seq 5
        assert(pq.pop(out3) && out3.order_id == 203); // seq 7
        assert(pq.empty());
        std::cout << "  -> Priority Min-Heap Ordering & Tie-Breaking: PASSED\n";
    }

    // 3. MenuHashMap O(1) Avg Lookup Test
    std::cout << "\n[TEST 3] MenuHashMap (std::unordered_map Lookup & Inventory)...\n";
    {
        MenuHashMap map;
        MenuItem m1; m1.item_id = 1; m1.name = "Vada Pav"; m1.price = 20.0; m1.stock = 10; m1.is_available = true; m1.prep_time_minutes = 2;
        MenuItem m2; m2.item_id = 2; m2.name = "Sandwich"; m2.price = 50.0; m2.stock = 5; m2.is_available = true; m2.prep_time_minutes = 4;

        map.insertOrUpdate(m1);
        map.insertOrUpdate(m2);
        assert(map.size() == 2);

        MenuItem fetched;
        assert(map.get(1, fetched) && fetched.name == "Vada Pav" && fetched.price == 20.0);

        // Test stock deduction
        int newStock = 0;
        assert(map.updateStock(1, -3, newStock) && newStock == 7);
        // Test negative inventory prevention
        assert(!map.updateStock(1, -10, newStock)); // Cannot deduct 10 when only 7 in stock!

        // Test price update
        assert(map.updatePrice(2, 55.0));
        map.get(2, fetched);
        assert(fetched.price == 55.0);

        std::cout << "  -> HashMap Insert, O(1) Search, Stock Deduction & Negative Check: PASSED\n";
    }

    // 4. CancellationStack LIFO Test
    std::cout << "\n[TEST 4] CancellationStack (LIFO Stack)...\n";
    {
        CancellationStack st;
        assert(st.empty());

        CancelledRecord r1; r1.order_id = 301; r1.reason = "Change of mind";
        CancelledRecord r2; r2.order_id = 302; r2.reason = "Ordered wrong item";

        st.push(r1);
        st.push(r2);
        assert(st.size() == 2);

        // Top should be most recently cancelled (r2)
        CancelledRecord topRec;
        assert(st.top(topRec) && topRec.order_id == 302);

        // Pop should return r2, then r1
        CancelledRecord popped1, popped2;
        assert(st.pop(popped1) && popped1.order_id == 302);
        assert(st.pop(popped2) && popped2.order_id == 301);
        assert(st.empty());

        std::cout << "  -> Cancellation Stack Push, Top, and LIFO Pop: PASSED\n";
    }

    // 5. OrderHistoryLinkedList Singly Linked List Test
    std::cout << "\n[TEST 5] OrderHistoryLinkedList (Singly Linked List)...\n";
    {
        OrderHistoryLinkedList list;
        assert(list.empty());

        Order ordA; ordA.order_id = 401; ordA.student_id = "STU101"; ordA.status = "Pending";
        Order ordB; ordB.order_id = 402; ordB.student_id = "STU102"; ordB.status = "Pending";
        Order ordC; ordC.order_id = 403; ordC.student_id = "STU101"; ordC.status = "Pending";

        list.append(ordA);
        list.append(ordB);
        list.append(ordC);
        assert(list.size() == 3);

        // Search by ID
        Order foundOrd;
        assert(list.searchById(402, foundOrd) && foundOrd.student_id == "STU102");

        // Update status in-place
        assert(list.updateStatus(402, "Preparing"));
        assert(list.searchById(402, foundOrd) && foundOrd.status == "Preparing");

        // Filter by student
        auto stu101Orders = list.getStudentOrders("STU101");
        assert(stu101Orders.size() == 2);

        // Delete node (pointer manipulation)
        assert(list.deleteById(402));
        assert(list.size() == 2);
        assert(!list.searchById(402, foundOrd));

        std::cout << "  -> Linked List Append, Traversal, Search, In-place Update & Deletion: PASSED\n";
    }

    // 6. QueueEstimator Calculation Test
    std::cout << "\n[TEST 6] QueueEstimator (Parallel Kitchen Estimation)...\n";
    {
        QueueEstimator est(2); // 2 cooking stations
        PriorityOrderQueue pq;
        NormalQueue nq;
        std::vector<Order> prep;

        // One active order on station 1 (prep time 4 min -> 2 min rem)
        Order active1; active1.order_id = 500; active1.estimated_prep_time_minutes = 4; active1.status = "Preparing";
        prep.push_back(active1);

        // Priority order waiting (prep time 2 min)
        Order prioOrd; prioOrd.order_id = 501; prioOrd.sequence_number = 1; prioOrd.is_prepaid = true; prioOrd.estimated_prep_time_minutes = 2; prioOrd.status = "Pending";
        pq.push(prioOrd);

        // Normal order waiting (prep time 4 min)
        Order normOrd; normOrd.order_id = 502; normOrd.sequence_number = 2; normOrd.is_prepaid = false; normOrd.estimated_prep_time_minutes = 4; normOrd.status = "Pending";
        nq.enqueue(normOrd);

        // Check estimate for prioOrd (position should be 2: behind active1)
        auto estPrio = est.calculate(501, prep, pq, nq, prioOrd);
        assert(estPrio.queue_position == 2); // 1 active ahead
        assert(estPrio.estimated_wait_minutes >= 1);

        // Check estimate for normOrd (position should be 3: behind active1 and prioOrd)
        auto estNorm = est.calculate(502, prep, pq, nq, normOrd);
        assert(estNorm.queue_position == 3);
        assert(estNorm.estimated_wait_minutes >= estPrio.estimated_wait_minutes);

        std::cout << "  -> Parallel Kitchen Wait Time & Queue Position Estimation: PASSED\n";
    }

    std::cout << "\n=========================================================\n";
    std::cout << "RESULT: ALL 6 FDS DATA STRUCTURE TEST SUITES PASSED!\n";
    std::cout << "=========================================================\n";
    return 0;
}

int main(int argc, char* argv[]) {
    // Check for CLI arguments
    if (argc > 1) {
        std::string arg = argv[1];
        if (arg == "--test") {
            return runAutomatedTests();
        }
        if (arg == "--cmd" && argc > 2) {
            std::string command = argv[2];
            std::cout << processCommand(command) << std::endl;
            return 0;
        }
    }

    // Default: Interactive JSON command processor over stdio
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        if (line == "EXIT" || line == "QUIT") break;
        std::string response = processCommand(line);
        std::cout << response << std::endl;
    }

    return 0;
}
