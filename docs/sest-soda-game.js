/**
 * @file sest-soda-game.js
 * Frontend logic for the Soda Game Results page.
 * Uses sql.js (WASM SQLite) for in-browser data access and ApexCharts for visualisation.
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES = ['factory', 'distributor', 'wholesaler', 'retailer'];

/** @type {Record<string, string>} */
const ROLE_LABELS = {
    factory: 'Factory',
    distributor: 'Distributor',
    wholesaler: 'Wholesaler',
    retailer: 'Retailer',
};

/** Bootstrap colour palette. */
const ROLE_COLORS = {
    factory: '#0d6efd', // blue
    distributor: '#198754', // green
    wholesaler: '#fd7e14', // orange
    retailer: '#dc3545', // red
};

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {import('sql.js').Database|null} */
let DB = null;

/** Active ApexCharts instances keyed by chart id. */
const charts = {sc: null, orders: null, inventory: null, backorder: null, surplus: null, costs: null};

// ─── sql.js helpers ───────────────────────────────────────────────────────────

/**
 * Run a parameterised query and return all rows as plain objects.
 * @param {string} sql
 * @param {(string|number)[]} [params]
 * @returns {Record<string, number|string>[]}
 */
function query(sql, params = []) {
    const stmt = DB.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// ─── Initialisation ───────────────────────────────────────────────────────────

async function init() {
    const SQL = await initSqlJs({locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${f}`});

    const resp = await fetch('game-data.db');
    if (!resp.ok) throw new Error(`Failed to fetch database: ${resp.status} ${resp.statusText}`);
    const buf = await resp.arrayBuffer();
    DB = new SQL.Database(new Uint8Array(buf));

    populateGroups();
    document.getElementById('group-select').addEventListener('change', onGroupChange);
    document.getElementById('game-select').addEventListener('change', onGameChange);
}

// ─── Selectors ────────────────────────────────────────────────────────────────

function populateGroups() {
    const rows = query('SELECT id, name FROM groups ORDER BY name');
    const sel = /** @type {HTMLSelectElement} */ (document.getElementById('group-select'));
    sel.innerHTML = '';
    for (const row of rows) {
        const opt = document.createElement('option');
        opt.value = String(row.id);
        opt.textContent = String(row.name);
        sel.appendChild(opt);
    }
    if (rows.length > 0) onGroupChange();
}

function onGroupChange() {
    const groupId = Number(document.getElementById('group-select').value);
    populateGames(groupId);
    renderScChart(groupId);
    onGameChange();
}

function populateGames(groupId) {
    const rows = query(
        'SELECT id, game_num FROM games WHERE group_id = ? ORDER BY game_num',
        [groupId],
    );
    const sel = /** @type {HTMLSelectElement} */ (document.getElementById('game-select'));
    sel.innerHTML = '';
    for (const row of rows) {
        const opt = document.createElement('option');
        opt.value = String(row.id);
        opt.textContent = `Game ${row.game_num}`;
        sel.appendChild(opt);
    }
}

function onGameChange() {
    const gameId = Number(document.getElementById('game-select').value);
    if (!gameId) return;
    renderGameView(gameId);
}

// ─── Supply Chain Chart (cohort level) ───────────────────────────────────────

/** @param {number} groupId */
function renderScChart(groupId) {
    const rows = query(`
        SELECT g.game_num, scw.week, scw.cost_acc
        FROM supply_chain_weekly scw
                 JOIN games g ON g.id = scw.game_id
        WHERE g.group_id = ?
        ORDER BY g.game_num, scw.week
    `, [groupId]);

    /** @type {Map<number, {x: number, y: number}[]>} */
    const byGame = new Map();
    for (const row of rows) {
        const num = Number(row.game_num);
        if (!byGame.has(num)) byGame.set(num, []);
        byGame.get(num).push({x: Number(row.week), y: Number(row.cost_acc)});
    }

    const series = Array.from(byGame.entries())
        .sort(([a], [b]) => a - b)
        .map(([num, data]) => ({name: `Game ${num}`, data}));

    destroyChart('sc');
    charts.sc = new ApexCharts(document.getElementById('sc-chart'), {
        chart: {type: 'line', height: 320, toolbar: {show: true}, animations: {enabled: false}},
        series,
        xaxis: {title: {text: 'Week'}, type: 'numeric', tickAmount: 'dataPoints'},
        yaxis: {title: {text: 'Cumulative Cost (£)'}, labels: {formatter: fmtCost}},
        stroke: {width: 2, curve: 'straight'},
        legend: {position: 'top'},
        tooltip: {x: {formatter: v => `Week ${v}`}, y: {formatter: fmtCost}},
        theme: {mode: 'light'},
    });
    charts.sc.render();
}

// ─── Game View ────────────────────────────────────────────────────────────────

/** @param {number} gameId */
function renderGameView(gameId) {
    const meta = query(
        'SELECT target_surplus, target_retailer_cost, target_supply_chain_cost FROM games WHERE id = ?',
        [gameId],
    );
    if (meta.length === 0) return;
    const {target_surplus, target_retailer_cost, target_supply_chain_cost} = meta[0];

    const weekly = query(`
        SELECT week,
               role,
               actual_order,
               inventory,
               backorder,
               incoming_order,
               surplus,
               cost_acc
        FROM weekly_stats
        WHERE game_id = ?
        ORDER BY week, role
    `, [gameId]);

    // Build a lookup: week → { role → row }
    /** @type {Map<number, Record<string, Record<string, number>>>} */
    const lookup = new Map();
    for (const row of weekly) {
        const w = Number(row.week);
        if (!lookup.has(w)) lookup.set(w, {});
        lookup.get(w)[String(row.role)] = row;
    }

    const weeks = Array.from(lookup.keys()).sort((a, b) => a - b);

    // Pivot into per-role arrays
    /** @type {Record<string, Record<string, number[]>>} */
    const byRole = {};
    for (const role of ROLES) {
        byRole[role] = {actual_order: [], inventory: [], backorder: [], incoming_order: [], surplus: [], cost_acc: []};
    }
    for (const w of weeks) {
        const weekData = lookup.get(w);
        for (const role of ROLES) {
            const r = weekData[role];
            byRole[role].actual_order.push(r ? Number(r.actual_order) : null);
            byRole[role].inventory.push(r ? Number(r.inventory) : null);
            byRole[role].backorder.push(r ? Number(r.backorder) : null);
            byRole[role].incoming_order.push(r ? Number(r.incoming_order) : null);
            byRole[role].surplus.push(r ? Number(r.surplus) : null);
            byRole[role].cost_acc.push(r ? Number(r.cost_acc) : null);
        }
    }

    renderStatsCards(byRole, weeks);
    renderOrdersChart(weeks, byRole);
    renderInventoryChart(weeks, byRole);
    renderBackorderChart(weeks, byRole);
    renderSurplusChart(weeks, byRole, Number(target_surplus));
    renderCostsChart(weeks, byRole, Number(target_retailer_cost), Number(target_supply_chain_cost), gameId);
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

/**
 * @param {Record<string, Record<string, number[]>>} byRole
 * @param {number[]} weeks
 */
function renderStatsCards(byRole, weeks) {
    const container = document.getElementById('stats-cards');
    container.innerHTML = '';
    const lastIdx = weeks.length - 1;

    for (const role of ROLES) {
        const totalOrders = byRole[role].actual_order.reduce((s, v) => s + (v ?? 0), 0);
        const finalSurplus = byRole[role].surplus[lastIdx] ?? 0;
        const totalCost = byRole[role].cost_acc[lastIdx] ?? 0;

        const col = document.createElement('div');
        col.className = 'col-sm-6 col-lg-3';
        col.innerHTML = `
      <div class="card h-100">
        <div class="card-header fw-semibold"
             style="border-top: 3px solid ${ROLE_COLORS[role]};">
          ${ROLE_LABELS[role]}
        </div>
        <ul class="list-group list-group-flush">
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-muted small">Total Orders</span>
            <strong>${totalOrders.toLocaleString()}</strong>
          </li>
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-muted small">Final Surplus</span>
            <strong>${finalSurplus.toLocaleString()}</strong>
          </li>
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-muted small">Total Cost</span>
            <strong>${fmtCost(totalCost)}</strong>
          </li>
        </ul>
      </div>`;
        container.appendChild(col);
    }
}

// ─── Chart Helpers ────────────────────────────────────────────────────────────

/** @param {number} v */
function fmtCost(v) {
    return `£${Math.round(v).toLocaleString()}`;
}

/**
 * Build role series for a given field.
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 * @param {string} field
 * @returns {object[]}
 */
function roleSeries(weeks, byRole, field) {
    return ROLES.map(role => ({
        name: ROLE_LABELS[role],
        color: ROLE_COLORS[role],
        data: weeks.map((w, i) => ({x: w, y: byRole[role][field][i]})),
    }));
}

/**
 * Base ApexCharts options shared by all per-game weekly charts.
 * @param {string} yTitle
 * @param {(v: number) => string} [yFormatter]
 * @returns {object}
 */
function baseOpts(yTitle, yFormatter = v => Math.round(v).toLocaleString()) {
    return {
        chart: {type: 'line', height: 300, toolbar: {show: true}, animations: {enabled: false}},
        xaxis: {title: {text: 'Week'}, type: 'numeric', tickAmount: 'dataPoints'},
        yaxis: {title: {text: yTitle}, labels: {formatter: yFormatter}},
        stroke: {width: 2, curve: 'straight'},
        legend: {position: 'top'},
        tooltip: {x: {formatter: v => `Week ${v}`}},
        theme: {mode: 'light'},
    };
}

/** @param {string} name */
function destroyChart(name) {
    if (charts[name]) {
        charts[name].destroy();
        charts[name] = null;
    }
}

// ─── Per-game Charts ──────────────────────────────────────────────────────────

/**
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 */
function renderOrdersChart(weeks, byRole) {
    const series = roleSeries(weeks, byRole, 'actual_order');
    // Customer demand = retailer's incoming_order, shown dashed
    series.push({
        name: 'Customer Demand',
        color: '#6c757d',
        data: weeks.map((w, i) => ({x: w, y: byRole.retailer.incoming_order[i]})),
    });

    destroyChart('orders');
    charts.orders = new ApexCharts(document.getElementById('chart-orders'), {
        ...baseOpts('Units'),
        series,
        stroke: {
            width: 2,
            curve: 'straight',
            dashArray: [0, 0, 0, 0, 5], // customer demand is dashed
        },
    });
    charts.orders.render();
}

/**
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 */
function renderInventoryChart(weeks, byRole) {
    destroyChart('inventory');
    charts.inventory = new ApexCharts(document.getElementById('chart-inventory'), {
        ...baseOpts('Units'),
        series: roleSeries(weeks, byRole, 'inventory'),
    });
    charts.inventory.render();
}

/**
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 */
function renderBackorderChart(weeks, byRole) {
    destroyChart('backorder');
    charts.backorder = new ApexCharts(document.getElementById('chart-backorder'), {
        ...baseOpts('Units'),
        series: roleSeries(weeks, byRole, 'backorder'),
    });
    charts.backorder.render();
}

/**
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 * @param {number} targetSurplus
 */
function renderSurplusChart(weeks, byRole, targetSurplus) {
    destroyChart('surplus');
    charts.surplus = new ApexCharts(document.getElementById('chart-surplus'), {
        ...baseOpts('Units'),
        series: roleSeries(weeks, byRole, 'surplus'),
        annotations: {
            yaxis: [{
                y: targetSurplus,
                borderColor: '#6c757d',
                borderWidth: 1,
                strokeDashArray: 4,
                label: {
                    text: `Target: ${targetSurplus.toLocaleString()}`,
                    style: {color: '#6c757d', background: '#fff', fontSize: '11px'},
                },
            }],
        },
    });
    charts.surplus.render();
}

/**
 * @param {number[]} weeks
 * @param {Record<string, Record<string, number[]>>} byRole
 * @param {number} targetRetailerCost
 * @param {number} targetSupplyChainCost
 * @param {number} gameId
 */
function renderCostsChart(weeks, byRole, targetRetailerCost, targetSupplyChainCost, gameId) {
    const scRows = query(
        'SELECT week, cost_acc FROM supply_chain_weekly WHERE game_id = ? ORDER BY week',
        [gameId],
    );

    const series = [
        ...roleSeries(weeks, byRole, 'cost_acc'),
        {
            name: 'Supply Chain',
            color: '#6c757d',
            data: scRows.map(r => ({x: Number(r.week), y: Number(r.cost_acc)})),
        },
    ];

    destroyChart('costs');
    charts.costs = new ApexCharts(document.getElementById('chart-costs'), {
        ...baseOpts('Cumulative Cost (£)', fmtCost),
        series,
        tooltip: {x: {formatter: v => `Week ${v}`}, y: {formatter: fmtCost}},
        annotations: {
            yaxis: [
                {
                    y: targetRetailerCost,
                    borderColor: ROLE_COLORS.retailer,
                    borderWidth: 1,
                    strokeDashArray: 4,
                    label: {
                        text: `Retailer target: ${fmtCost(targetRetailerCost)}`,
                        style: {color: ROLE_COLORS.retailer, background: '#fff', fontSize: '11px'},
                    },
                },
                {
                    y: targetSupplyChainCost,
                    borderColor: '#6c757d',
                    borderWidth: 1,
                    strokeDashArray: 4,
                    label: {
                        text: `SC target: ${fmtCost(targetSupplyChainCost)}`,
                        style: {color: '#6c757d', background: '#fff', fontSize: '11px'},
                    },
                },
            ],
        },
    });
    charts.costs.render();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init().catch(err => {
    console.error('Soda Game: failed to initialise', err);
    document.querySelector('.container').insertAdjacentHTML('afterbegin', `
    <div class="alert alert-danger" role="alert">
      <strong>Failed to load data.</strong> ${err.message}
    </div>`);
});
