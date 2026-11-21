#ifndef PRIORITY_QUEUE_H
#define PRIORITY_QUEUE_H

#include "models.h"
#include <vector>
#include <sstream>
#include <algorithm>

/**
 * PriorityOrderQueue - Priority Queue for Prepaid Orders in Smart Canteen.
 * 
 * Data Structure: Binary Min-Heap / Priority Queue based on sequence number.
 * Priority Rules:
 * 1. All prepaid orders have priority over standard orders in overall processing.
 * 2. Among prepaid orders, tie-breaking strictly follows FIFO order based on 
 *    monotonic sequence_number (smaller sequence_number means order was placed earlier).
 * 
 * Operations:
 * - push(): O(log N) insertion maintaining heap invariant
 * - pop(): O(log N) extraction of highest-priority order
 * - top(): O(1) peek at highest-priority order
 * - removeById(): O(N) safe removal for cancellations or targeted dispatch
 */
class PriorityOrderQueue {
private:
    std::vector<Order> heap;

    // Comparator for min-heap by sequence_number
    static bool compare(const Order& a, const Order& b) {
        // We want a min-heap where lowest sequence_number has highest priority
        return a.sequence_number > b.sequence_number;
    }

    void heapifyUp(size_t index) {
        while (index > 0) {
            size_t parent = (index - 1) / 2;
            if (heap[index].sequence_number < heap[parent].sequence_number) {
                std::swap(heap[index], heap[parent]);
                index = parent;
            } else {
                break;
            }
        }
    }

    void heapifyDown(size_t index) {
        size_t size = heap.size();
        while (true) {
            size_t left = 2 * index + 1;
            size_t right = 2 * index + 2;
            size_t smallest = index;

            if (left < size && heap[left].sequence_number < heap[smallest].sequence_number) {
                smallest = left;
            }
            if (right < size && heap[right].sequence_number < heap[smallest].sequence_number) {
                smallest = right;
            }

            if (smallest != index) {
                std::swap(heap[index], heap[smallest]);
                index = smallest;
            } else {
                break;
            }
        }
    }

public:
    PriorityOrderQueue() {}

    void push(const Order& order) {
        heap.push_back(order);
        heapifyUp(heap.size() - 1);
    }

    bool empty() const {
        return heap.empty();
    }

    size_t size() const {
        return heap.size();
    }

    bool top(Order& outOrder) const {
        if (heap.empty()) return false;
        outOrder = heap[0];
        return true;
    }

    bool pop(Order& outOrder) {
        if (heap.empty()) return false;
        outOrder = heap[0];
        heap[0] = heap.back();
        heap.pop_back();
        if (!heap.empty()) {
            heapifyDown(0);
        }
        return true;
    }

    bool removeById(int orderId, Order& outRemovedOrder) {
        for (size_t i = 0; i < heap.size(); ++i) {
            if (heap[i].order_id == orderId) {
                outRemovedOrder = heap[i];
                heap[i] = heap.back();
                heap.pop_back();
                if (i < heap.size()) {
                    heapifyDown(i);
                    heapifyUp(i);
                }
                return true;
            }
        }
        return false;
    }

    bool contains(int orderId) const {
        for (const auto& ord : heap) {
            if (ord.order_id == orderId) return true;
        }
        return false;
    }

    // Return the sorted order of elements (highest priority to lowest priority)
    std::vector<Order> toSortedVector() const {
        // Clone heap and extract one-by-one to get strict priority order
        PriorityOrderQueue temp = *this;
        std::vector<Order> sorted;
        Order ord;
        while (temp.pop(ord)) {
            sorted.push_back(ord);
        }
        return sorted;
    }

    int getPosition(int orderId) const {
        std::vector<Order> sorted = toSortedVector();
        for (size_t i = 0; i < sorted.size(); ++i) {
            if (sorted[i].order_id == orderId) {
                return static_cast<int>(i + 1);
            }
        }
        return -1;
    }

    std::string toJson() const {
        std::vector<Order> sorted = toSortedVector();
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < sorted.size(); ++i) {
            const Order& o = sorted[i];
            if (i > 0) ss << ",";
            ss << "{"
               << "\"order_id\":" << o.order_id << ","
               << "\"student_id\":\"" << escapeJson(o.student_id) << "\","
               << "\"student_name\":\"" << escapeJson(o.student_name) << "\","
               << "\"total_amount\":" << o.total_amount << ","
               << "\"status\":\"" << escapeJson(o.status) << "\","
               << "\"sequence_number\":" << o.sequence_number << ","
               << "\"prep_time_minutes\":" << o.estimated_prep_time_minutes << ","
               << "\"priority_rank\":" << (i + 1)
               << "}";
        }
        ss << "]";
        return ss.str();
    }
};

#endif // PRIORITY_QUEUE_H
