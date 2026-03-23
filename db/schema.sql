CREATE TABLE IF NOT EXISTS groups (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS games (
    id                       INTEGER PRIMARY KEY,
    group_id                 INTEGER NOT NULL REFERENCES groups(id),
    game_num                 INTEGER NOT NULL,
    transcentis_id           TEXT    NOT NULL,
    target_surplus           INTEGER NOT NULL,
    target_retailer_cost     INTEGER NOT NULL,
    target_supply_chain_cost INTEGER NOT NULL,
    UNIQUE(group_id, game_num)
);

CREATE TABLE IF NOT EXISTS weekly_stats (
    id                INTEGER PRIMARY KEY,
    game_id           INTEGER NOT NULL REFERENCES games(id),
    week              INTEGER NOT NULL,
    role              TEXT    NOT NULL CHECK(role IN ('factory','distributor','wholesaler','retailer')),
    actual_order      INTEGER NOT NULL,
    open_orders       INTEGER NOT NULL,
    inventory         INTEGER NOT NULL,
    backorder         INTEGER NOT NULL,
    incoming_delivery INTEGER NOT NULL,
    incoming_order    INTEGER NOT NULL,
    outgoing_delivery INTEGER NOT NULL,
    surplus           INTEGER NOT NULL,
    cost              REAL    NOT NULL,
    cost_acc          REAL    NOT NULL,
    UNIQUE(game_id, week, role)
);

CREATE TABLE IF NOT EXISTS supply_chain_weekly (
    id       INTEGER PRIMARY KEY,
    game_id  INTEGER NOT NULL REFERENCES games(id),
    week     INTEGER NOT NULL,
    cost_acc REAL    NOT NULL,
    UNIQUE(game_id, week)
);
