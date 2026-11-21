#ifndef NORMAL_QUEUE_H
#define NORMAL_QUEUE_H

#include "models.h"
#include <deque>
#include <vector>
#include <sstream>
#include <algorithm>

/**
 * NormalQueue - Implementation of FIFO Queue for Regular (Non-prepaid) Canteen Orders.
 * 
 * Data Structure: FIFO Queue (implemented with std::deque as underlying storage container)
 * Theoretical Properties:
 * - Enqueue: O(1) amortized time complexity
 * - Dequeue: O(1) time complexity
 * - Front: O(1) time complexity
 * - Safe Cancellation Removal: O(N) linear scan while strictly preserving relative order of other elements
 */
class NormalQueue {
private:
    std::deque<Order> elements;

public:
    NormalQueue() {}

    // Enqueue a standard order to the rear of the queue
    void enqueue(const Order& order) {
        elements.push_back(order);
    }

    // Check if the queue is empty
    bool empty() const {
        return elements.empty();
    }

    // Number of orders waiting in the queue
    size_t size() const {
        return elements.size();
    }

    // View the front order without removing it
    bool front(Order& outOrder) const {
        if (elements.empty()) return false;
        outOrder = elements.front();
        return true;
    }

    // Dequeue the order at the front
    bool dequeue(Order& outOrder) {
        if (elements.empty()) return false;
        outOrder = elements.front();
        elements.pop_front();
        return true;
    }

    // Advance/remove an order when preparation starts or when specified by ID
    bool removeById(int orderId, Order& outRemovedOrder) {
        for (auto it = elements.begin(); it != elements.end(); ++it) {
            if (it->order_id == orderId) {
                outRemovedOrder = *it;
                elements.erase(it);
                return true;
            }
        }
        return false;
    }

    // Check if an order exists in the normal queue
    bool contains(int orderId) const {
        for (const auto& ord : elements) {
            if (ord.order_id == orderId) return true;
        }
        return false;
    }

    // Return the 1-based queue index of an order in this queue, or -1 if not found
    int getPosition(int orderId) const {
        int pos = 1;
        for (const auto& ord : elements) {
            if (ord.order_id == orderId) return pos;
            pos++;
        }
        return -1;
    }

    // Export elements from front to rear as a vector
    std::vector<Order> toVector() const {
        return std::vector<Order>(elements.begin(), elements.end());
    }

    // Serialize queue elements to JSON string for frontend visualizer
    std::string toJson() const {
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < elements.size(); ++i) {
            const Order& o = elements[i];
            if (i > 0) ss << ",";
            ss << "{"
               << "\"order_id\":" << o.order_id << ","
               << "\"student_id\":\"" << escapeJson(o.student_id) << "\","
               << "\"student_name\":\"" << escapeJson(o.student_name) << "\","
               << "\"total_amount\":" << o.total_amount << ","
               << "\"status\":\"" << escapeJson(o.status) << "\","
               << "\"sequence_number\":" << o.sequence_number << ","
               << "\"prep_time_minutes\":" << o.estimated_prep_time_minutes << ","
               << "\"queue_index\":" << (i + 1)
               << "}";
        }
        ss << "]";
        return ss.str();
    }
};

#endif // NORMAL_QUEUE_H
