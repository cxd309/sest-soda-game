-- name: UpsertGroup :one
-- noinspection SqlResolve
INSERT INTO groups (name)
VALUES (sqlc.arg(name))
ON CONFLICT(name) DO UPDATE SET name = name
RETURNING id;

-- name: InsertGame :one
-- noinspection SqlResolve
INSERT INTO games (group_id, game_num, transcentis_id, target_surplus, target_retailer_cost, target_supply_chain_cost)
VALUES (sqlc.arg(group_id), sqlc.arg(game_num), sqlc.arg(transcentis_id), sqlc.arg(target_surplus), sqlc.arg(target_retailer_cost), sqlc.arg(target_supply_chain_cost))
RETURNING id;

-- name: InsertWeeklyStat :exec
-- noinspection SqlResolve
INSERT INTO weekly_stats (game_id, week, role, actual_order, open_orders, inventory, backorder, incoming_delivery, incoming_order, outgoing_delivery, surplus, cost, cost_acc)
VALUES (sqlc.arg(game_id), sqlc.arg(week), sqlc.arg(role), sqlc.arg(actual_order), sqlc.arg(open_orders), sqlc.arg(inventory), sqlc.arg(backorder), sqlc.arg(incoming_delivery), sqlc.arg(incoming_order), sqlc.arg(outgoing_delivery), sqlc.arg(surplus), sqlc.arg(cost), sqlc.arg(cost_acc));

-- name: InsertSupplyChainWeekly :exec
-- noinspection SqlResolve
INSERT INTO supply_chain_weekly (game_id, week, cost_acc)
VALUES (sqlc.arg(game_id), sqlc.arg(week), sqlc.arg(cost_acc));
