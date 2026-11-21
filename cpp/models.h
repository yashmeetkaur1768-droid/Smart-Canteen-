#ifndef MODELS_H
#define MODELS_H

#include <string>
#include <vector>
#include <sstream>

struct OrderItem {
    int item_id;
    std::string item_name;
    double price;
    int quantity;
    double subtotal;
};

struct Order {
    int order_id;
    std::string student_id;
    std::string student_name;
    bool is_prepaid; // true = Priority Queue, false = Normal FIFO Queue
    std::string status; // "Pending", "Preparing", "Ready", "Completed", "Cancelled"
    double total_amount;
    long long sequence_number; // Monotonically increasing for strict FIFO tie-breaking
    std::string created_at;
    int estimated_prep_time_minutes; // Calculated from items
    std::vector<OrderItem> items;
};

struct MenuItem {
    int item_id;
    std::string name;
    double price;
    int stock;
    bool is_available;
    int prep_time_minutes;
    std::string category;
};

struct CancelledRecord {
    int order_id;
    std::string student_id;
    std::string cancelled_at;
    std::string reason;
    double refund_amount;
    std::string items_summary;
};

struct LogEntry {
    std::string timestamp;
    std::string structure; // "Queue", "PriorityQueue", "HashMap", "Stack", "LinkedList"
    std::string operation;
    std::string details;
};

// Simple JSON helper functions to avoid heavy external dependencies
inline std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if (c >= 0 && c <= 0x1f) {
            // control character
        } else {
            o << c;
        }
    }
    return o.str();
}

#endif // MODELS_H
