#ifndef CANCELLATION_STACK_H
#define CANCELLATION_STACK_H

#include "models.h"
#include <vector>
#include <sstream>

/**
 * CancellationStack - LIFO Stack recording Cancelled Orders in Smart Canteen.
 * 
 * Data Structure: LIFO (Last-In-First-Out) Stack
 * Theoretical Properties:
 * - push(): O(1) time complexity - pushes newly cancelled order record onto the top of the stack
 * - pop(): O(1) time complexity - removes the top element
 * - top(): O(1) time complexity - inspects the most recently cancelled order
 * - toVector(): O(N) top-to-bottom traversal showing newest cancellations first
 * 
 * College Viva Context:
 * Demonstrates LIFO behavior for cancellation audits and staff review.
 * Backed permanently by SQLite to survive system restarts, and rehydrated into the in-memory stack.
 */
class CancellationStack {
private:
    std::vector<CancelledRecord> elements; // vector used as stack where back() is top

public:
    CancellationStack() {}

    // Push cancelled order record onto the top of the stack
    void push(const CancelledRecord& record) {
        elements.push_back(record);
    }

    // Inspect the most recently cancelled order
    bool top(CancelledRecord& outRecord) const {
        if (elements.empty()) return false;
        outRecord = elements.back();
        return true;
    }

    // Pop the most recently cancelled order
    bool pop(CancelledRecord& outRecord) {
        if (elements.empty()) return false;
        outRecord = elements.back();
        elements.pop_back();
        return true;
    }

    bool empty() const {
        return elements.empty();
    }

    size_t size() const {
        return elements.size();
    }

    void clear() {
        elements.clear();
    }

    // Return records from top to bottom (most recent first)
    std::vector<CancelledRecord> toTopToBottomVector() const {
        std::vector<CancelledRecord> result;
        result.reserve(elements.size());
        for (auto it = elements.rbegin(); it != elements.rend(); ++it) {
            result.push_back(*it);
        }
        return result;
    }

    // JSON representation for visualizer
    std::string toJson() const {
        std::vector<CancelledRecord> topToBottom = toTopToBottomVector();
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < topToBottom.size(); ++i) {
            const CancelledRecord& r = topToBottom[i];
            if (i > 0) ss << ",";
            ss << "{"
               << "\"order_id\":" << r.order_id << ","
               << "\"student_id\":\"" << escapeJson(r.student_id) << "\","
               << "\"cancelled_at\":\"" << escapeJson(r.cancelled_at) << "\","
               << "\"reason\":\"" << escapeJson(r.reason) << "\","
               << "\"refund_amount\":" << r.refund_amount << ","
               << "\"items_summary\":\"" << escapeJson(r.items_summary) << "\","
               << "\"stack_depth\":" << (i + 1)
               << "}";
        }
        ss << "]";
        return ss.str();
    }
};

#endif // CANCELLATION_STACK_H
