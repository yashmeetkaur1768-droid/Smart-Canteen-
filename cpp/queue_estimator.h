#ifndef QUEUE_ESTIMATOR_H
#define QUEUE_ESTIMATOR_H

#include "models.h"
#include "normal_queue.h"
#include "priority_queue.h"
#include <cmath>
#include <vector>

/**
 * QueueEstimator - Dynamic Queue Position and Wait Time Calculation Engine.
 * 
 * Mathematical Formulation:
 * 1. Stations (S): Canteen operates S parallel preparation stations (default S = 2).
 * 2. Active Orders (Preparing): Occupy stations; estimated remaining work is max(1, prep_time / 2).
 * 3. Priority Dispatch:
 *    - Waiting Priority Orders take precedence over waiting Normal Orders.
 *    - Within each category, ties are resolved using strict FIFO (sequence number).
 * 4. Orders Ahead of Target (T):
 *    - If T is 'Preparing': Position is 1; wait time is remaining portion of its prep time.
 *    - If T is 'Pending' & 'Prepaid' (Priority):
 *        Orders ahead = [All Active Preparing Orders] + [Waiting Priority Orders with seq < T.seq].
 *    - If T is 'Pending' & 'Normal':
 *        Orders ahead = [All Active Preparing Orders] + [ALL Waiting Priority Orders] + [Waiting Normal Orders ahead of T].
 * 5. Time Estimation:
 *    Wait Time = ceil( (Total Work Ahead + Target Order Prep Time) / S )
 */
class QueueEstimator {
private:
    int parallelStations;

public:
    QueueEstimator(int stations = 2) : parallelStations(stations > 0 ? stations : 2) {}

    void setParallelStations(int stations) {
        if (stations > 0) parallelStations = stations;
    }

    int getParallelStations() const {
        return parallelStations;
    }

    struct EstimateResult {
        int queue_position;
        int estimated_wait_minutes;
        std::string status;
        int orders_ahead_count;
        int active_stations_in_use;
    };

    EstimateResult calculate(
        int targetOrderId,
        const std::vector<Order>& preparingOrders,
        const PriorityOrderQueue& priorityQueue,
        const NormalQueue& normalQueue,
        const Order& targetOrder
    ) const {
        EstimateResult result;
        result.status = targetOrder.status;
        result.active_stations_in_use = static_cast<int>(preparingOrders.size());

        if (targetOrder.status == "Completed") {
            result.queue_position = 0;
            result.estimated_wait_minutes = 0;
            result.orders_ahead_count = 0;
            return result;
        }

        if (targetOrder.status == "Cancelled") {
            result.queue_position = -1;
            result.estimated_wait_minutes = 0;
            result.orders_ahead_count = 0;
            return result;
        }

        if (targetOrder.status == "Ready") {
            result.queue_position = 0;
            result.estimated_wait_minutes = 0;
            result.orders_ahead_count = 0;
            return result;
        }

        if (targetOrder.status == "Preparing") {
            result.queue_position = 1;
            result.orders_ahead_count = 0;
            // Half prep time remaining on average
            int rem = targetOrder.estimated_prep_time_minutes / 2;
            result.estimated_wait_minutes = (rem > 0) ? rem : 1;
            return result;
        }

        // Target order is "Pending"
        int totalWorkAheadMinutes = 0;
        int ordersAheadCount = 0;

        // 1. Account for currently preparing orders
        for (const auto& ord : preparingOrders) {
            ordersAheadCount++;
            int remWork = ord.estimated_prep_time_minutes / 2;
            totalWorkAheadMinutes += (remWork > 0 ? remWork : 1);
        }

        // 2. Account for waiting Priority Orders
        std::vector<Order> prioOrders = priorityQueue.toSortedVector();
        if (targetOrder.is_prepaid) {
            // Target is a Priority Order: only earlier priority orders are ahead
            for (const auto& ord : prioOrders) {
                if (ord.order_id == targetOrderId) break;
                if (ord.sequence_number < targetOrder.sequence_number) {
                    ordersAheadCount++;
                    totalWorkAheadMinutes += (ord.estimated_prep_time_minutes > 0 ? ord.estimated_prep_time_minutes : 2);
                }
            }
        } else {
            // Target is a Normal Order: ALL waiting Priority Orders jump ahead
            for (const auto& ord : prioOrders) {
                ordersAheadCount++;
                totalWorkAheadMinutes += (ord.estimated_prep_time_minutes > 0 ? ord.estimated_prep_time_minutes : 2);
            }

            // Plus Normal Orders ahead of target
            std::vector<Order> normOrders = normalQueue.toVector();
            for (const auto& ord : normOrders) {
                if (ord.order_id == targetOrderId) break;
                ordersAheadCount++;
                totalWorkAheadMinutes += (ord.estimated_prep_time_minutes > 0 ? ord.estimated_prep_time_minutes : 2);
            }
        }

        result.orders_ahead_count = ordersAheadCount;
        result.queue_position = ordersAheadCount + 1;

        int targetPrepTime = targetOrder.estimated_prep_time_minutes > 0 ? targetOrder.estimated_prep_time_minutes : 2;
        int totalWork = totalWorkAheadMinutes + targetPrepTime;

        // Divide by parallel preparation stations
        int estMinutes = static_cast<int>(std::ceil(static_cast<double>(totalWork) / parallelStations));
        if (estMinutes < 1) estMinutes = 1;

        result.estimated_wait_minutes = estMinutes;
        return result;
    }
};

#endif // QUEUE_ESTIMATOR_H
