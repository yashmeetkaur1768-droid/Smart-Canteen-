#ifndef MENU_HASHMAP_H
#define MENU_HASHMAP_H

#include "models.h"
#include <unordered_map>
#include <vector>
#include <sstream>
#include <algorithm>

/**
 * MenuHashMap - Fast Menu and Inventory Lookup Engine.
 * 
 * Data Structure: Hash Map (std::unordered_map<int, MenuItem>)
 * Complexity Analysis:
 * - Search by item_id: Average O(1), Worst-case O(N) (due to potential hash bucket collisions)
 * - Insertion: Average O(1), Worst-case O(N) when rehashing occurs
 * - Update (stock/price): Average O(1)
 * - Deletion/Deactivation: Average O(1)
 * 
 * Purpose:
 * Provides sub-millisecond in-memory verification for stock availability and menu pricing,
 * acting as an in-memory cache synchronized with the persistent SQLite database.
 */
class MenuHashMap {
private:
    std::unordered_map<int, MenuItem> table;

public:
    MenuHashMap() {}

    // Insert or update a menu item
    void insertOrUpdate(const MenuItem& item) {
        table[item.item_id] = item;
    }

    // Retrieve item by ID (Search operation)
    bool get(int itemId, MenuItem& outItem) const {
        auto it = table.find(itemId);
        if (it != table.end()) {
            outItem = it->second;
            return true;
        }
        return false;
    }

    // Check if an item exists
    bool exists(int itemId) const {
        return table.find(itemId) != table.end();
    }

    // Update stock portion quantity (positive to restock, negative to reserve/deduct)
    bool updateStock(int itemId, int deltaQuantity, int& outNewStock) {
        auto it = table.find(itemId);
        if (it == table.end()) return false;

        int resultingStock = it->second.stock + deltaQuantity;
        if (resultingStock < 0) {
            // Cannot have negative inventory!
            return false;
        }

        it->second.stock = resultingStock;
        it->second.is_available = (resultingStock > 0);
        outNewStock = resultingStock;
        return true;
    }

    // Set absolute stock
    bool setStock(int itemId, int newStock) {
        auto it = table.find(itemId);
        if (it == table.end() || newStock < 0) return false;
        it->second.stock = newStock;
        it->second.is_available = (newStock > 0);
        return true;
    }

    // Update item price
    bool updatePrice(int itemId, double newPrice) {
        auto it = table.find(itemId);
        if (it == table.end() || newPrice < 0) return false;
        it->second.price = newPrice;
        return true;
    }

    // Check if sufficient stock is available
    bool checkAvailability(int itemId, int requestedQuantity) const {
        auto it = table.find(itemId);
        if (it == table.end()) return false;
        return it->second.is_available && (it->second.stock >= requestedQuantity);
    }

    // Deactivate an item (logical deletion)
    bool deactivate(int itemId) {
        auto it = table.find(itemId);
        if (it == table.end()) return false;
        it->second.is_available = false;
        return true;
    }

    // Remove item from hashmap
    bool remove(int itemId) {
        return table.erase(itemId) > 0;
    }

    // Clear hashmap
    void clear() {
        table.clear();
    }

    size_t size() const {
        return table.size();
    }

    // Return all items as vector sorted by ID
    std::vector<MenuItem> toVector() const {
        std::vector<MenuItem> items;
        for (const auto& kv : table) {
            items.push_back(kv.second);
        }
        std::sort(items.begin(), items.end(), [](const MenuItem& a, const MenuItem& b) {
            return a.item_id < b.item_id;
        });
        return items;
    }

    // JSON representation for visualizer
    std::string toJson() const {
        std::vector<MenuItem> items = toVector();
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < items.size(); ++i) {
            const MenuItem& m = items[i];
            if (i > 0) ss << ",";
            ss << "{"
               << "\"item_id\":" << m.item_id << ","
               << "\"name\":\"" << escapeJson(m.name) << "\","
               << "\"price\":" << m.price << ","
               << "\"stock\":" << m.stock << ","
               << "\"is_available\":" << (m.is_available ? "true" : "false") << ","
               << "\"prep_time_minutes\":" << m.prep_time_minutes << ","
               << "\"category\":\"" << escapeJson(m.category) << "\""
               << "}";
        }
        ss << "]";
        return ss.str();
    }
};

#endif // MENU_HASHMAP_H
