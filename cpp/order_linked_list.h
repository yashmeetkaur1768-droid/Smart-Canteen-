#ifndef ORDER_LINKED_LIST_H
#define ORDER_LINKED_LIST_H

#include "models.h"
#include <vector>
#include <sstream>

/**
 * Node structure for Singly Linked List holding Order History.
 */
struct OrderNode {
    Order order;
    OrderNode* next;

    OrderNode(const Order& ord) : order(ord), next(nullptr) {}
};

/**
 * OrderHistoryLinkedList - Singly Linked List for Order History.
 * 
 * Data Structure: Singly Linked List (Explicit node and pointer manipulation)
 * Theoretical Properties:
 * - Append (Insert at tail): O(1) with tail pointer
 * - Traversal: O(N)
 * - Search by ID: O(N) linear search
 * - Update status: O(N) search and in-place node modification
 * - Delete by ID: O(N) search followed by O(1) pointer unlinking and memory free
 * - Memory Management: Strict RAII cleanup in destructor and clear() to prevent memory leaks.
 * 
 * Rehydration & Persistence:
 * On server startup, records from SQLite 'orders' table are read and appended in chronological order,
 * rebuilding the in-memory linked list.
 */
class OrderHistoryLinkedList {
private:
    OrderNode* head;
    OrderNode* tail;
    size_t count;

public:
    OrderHistoryLinkedList() : head(nullptr), tail(nullptr), count(0) {}

    // Destructor ensures zero memory leaks by freeing every node
    ~OrderHistoryLinkedList() {
        clear();
    }

    // Disable copy constructor and assignment operator to prevent shallow copy issues
    OrderHistoryLinkedList(const OrderHistoryLinkedList&) = delete;
    OrderHistoryLinkedList& operator=(const OrderHistoryLinkedList&) = delete;

    // Clear all dynamically allocated nodes
    void clear() {
        OrderNode* current = head;
        while (current != nullptr) {
            OrderNode* nextNode = current->next;
            delete current;
            current = nextNode;
        }
        head = nullptr;
        tail = nullptr;
        count = 0;
    }

    // Append newly accepted order to the tail of the linked list (O(1))
    void append(const Order& order) {
        OrderNode* newNode = new OrderNode(order);
        if (head == nullptr) {
            head = newNode;
            tail = newNode;
        } else {
            tail->next = newNode;
            tail = newNode;
        }
        count++;
    }

    // Linear search by order ID (O(N))
    bool searchById(int orderId, Order& outOrder) const {
        OrderNode* current = head;
        while (current != nullptr) {
            if (current->order.order_id == orderId) {
                outOrder = current->order;
                return true;
            }
            current = current->next;
        }
        return false;
    }

    // Update the status of an order in the linked list
    bool updateStatus(int orderId, const std::string& newStatus) {
        OrderNode* current = head;
        while (current != nullptr) {
            if (current->order.order_id == orderId) {
                current->order.status = newStatus;
                return true;
            }
            current = current->next;
        }
        return false;
    }

    // Retrieve all orders belonging to a specific student
    std::vector<Order> getStudentOrders(const std::string& studentId) const {
        std::vector<Order> results;
        OrderNode* current = head;
        while (current != nullptr) {
            if (current->order.student_id == studentId) {
                results.push_back(current->order);
            }
            current = current->next;
        }
        return results;
    }

    // Delete a node by order ID (demonstrating pointer manipulation & dynamic memory deallocation)
    bool deleteById(int orderId) {
        if (head == nullptr) return false;

        OrderNode* current = head;
        OrderNode* prev = nullptr;

        while (current != nullptr && current->order.order_id != orderId) {
            prev = current;
            current = current->next;
        }

        if (current == nullptr) {
            // Not found
            return false;
        }

        // Unlink node
        if (prev == nullptr) {
            head = current->next;
            if (head == nullptr) {
                tail = nullptr;
            }
        } else {
            prev->next = current->next;
            if (current == tail) {
                tail = prev;
            }
        }

        delete current;
        count--;
        return true;
    }

    size_t size() const {
        return count;
    }

    bool empty() const {
        return head == nullptr;
    }

    // Traverse and return all orders as a vector
    std::vector<Order> toVector() const {
        std::vector<Order> list;
        list.reserve(count);
        OrderNode* current = head;
        while (current != nullptr) {
            list.push_back(current->order);
            current = current->next;
        }
        return list;
    }

    // Serialize linked list nodes with pointer representation for visualizer
    std::string toJson() const {
        std::ostringstream ss;
        ss << "[";
        OrderNode* current = head;
        size_t index = 0;
        while (current != nullptr) {
            if (index > 0) ss << ",";
            const Order& o = current->order;
            ss << "{"
               << "\"node_index\":" << index << ","
               << "\"order_id\":" << o.order_id << ","
               << "\"student_id\":\"" << escapeJson(o.student_id) << "\","
               << "\"student_name\":\"" << escapeJson(o.student_name) << "\","
               << "\"total_amount\":" << o.total_amount << ","
               << "\"status\":\"" << escapeJson(o.status) << "\","
               << "\"is_prepaid\":" << (o.is_prepaid ? "true" : "false") << ","
               << "\"created_at\":\"" << escapeJson(o.created_at) << "\","
               << "\"has_next\":" << (current->next != nullptr ? "true" : "false")
               << "}";
            current = current->next;
            index++;
        }
        ss << "]";
        return ss.str();
    }
};

#endif // ORDER_LINKED_LIST_H
