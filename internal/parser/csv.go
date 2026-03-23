package parser

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var filenamePattern = regexp.MustCompile(`^(.+) - Game (\d+)\.csv$`)

// ParsedGame holds all data extracted from a single game CSV file.
type ParsedGame struct {
	Group                 string
	GameNum               int
	TransentisID          string
	TargetSurplus         int64
	TargetRetailerCost    int64
	TargetSupplyChainCost int64
	Rows                  []ParsedRow
}

// ParsedRow holds data for a single timestep.
type ParsedRow struct {
	Week               int64
	Roles              []RoleStat
	SupplyChainCostAcc float64
}

// RoleStat holds metrics for a single role in a single timestep.
type RoleStat struct {
	Role             string
	ActualOrder      int64
	OpenOrders       int64
	Inventory        int64
	Backorder        int64
	IncomingDelivery int64
	IncomingOrder    int64
	OutgoingDelivery int64
	Surplus          int64
	Cost             float64
	CostAcc          float64
}

type csvRoleDef struct {
	prefix         string
	dbName         string
	actualOrderCol string
}

// csvRoles maps Transentis CSV column prefixes to DB role names.
// BREWERY is the Factory role — renamed at import time.
var csvRoles = []csvRoleDef{
	{"BREWERY", "factory", "BREWERYactualProduction"},
	{"DISTRIBUTOR", "distributor", "DISTRIBUTORactualOrder"},
	{"WHOLESALER", "wholesaler", "WHOLESALERactualOrder"},
	{"RETAILER", "retailer", "RETAILERactualOrder"},
}

// ParseFile parses a Transentis game CSV export into a ParsedGame.
// The filename must match the pattern "{Group} - Game {N}.csv".
// Week numbers are derived from row position (1-based), not the CSV id column.
func ParseFile(path string) (*ParsedGame, error) {
	matches := filenamePattern.FindStringSubmatch(filepath.Base(path))
	if matches == nil {
		return nil, fmt.Errorf("filename does not match expected pattern: %s", filepath.Base(path))
	}

	group := matches[1]
	gameNum, _ := strconv.Atoi(matches[2])

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	headers, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read headers: %w", err)
	}

	idx := make(map[string]int, len(headers))
	for i, h := range headers {
		idx[h] = i
	}

	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read records: %w", err)
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("no data rows")
	}

	getInt := func(record []string, col string) (int64, error) {
		i, ok := idx[col]
		if !ok {
			return 0, fmt.Errorf("column not found: %s", col)
		}
		v, err := strconv.ParseInt(strings.TrimSpace(record[i]), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse %s=%q: %w", col, record[i], err)
		}
		return v, nil
	}

	getFloat := func(record []string, col string) (float64, error) {
		i, ok := idx[col]
		if !ok {
			return 0, fmt.Errorf("column not found: %s", col)
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(record[i]), 64)
		if err != nil {
			return 0, fmt.Errorf("parse %s=%q: %w", col, record[i], err)
		}
		return v, nil
	}

	// Game-level fields are constant across all rows; read from the first row.
	transentisID := strings.TrimSpace(records[0][idx["gameId"]])
	targetSurplus, err := getInt(records[0], "policySettingstargetSurplus")
	if err != nil {
		return nil, err
	}
	targetRetailerCost, err := getInt(records[0], "policySettingstargetRETAILERCost")
	if err != nil {
		return nil, err
	}
	targetSupplyChainCost, err := getInt(records[0], "policySettingstargetSupplyChainCost")
	if err != nil {
		return nil, err
	}

	game := &ParsedGame{
		Group:                 group,
		GameNum:               gameNum,
		TransentisID:          transentisID,
		TargetSurplus:         targetSurplus,
		TargetRetailerCost:    targetRetailerCost,
		TargetSupplyChainCost: targetSupplyChainCost,
		Rows:                  make([]ParsedRow, 0, len(records)),
	}

	for i, record := range records {
		week := int64(i + 1)

		scCostAcc, err := getFloat(record, "performanceControllingsupplyChainCostAcc")
		if err != nil {
			return nil, fmt.Errorf("row %d: %w", week, err)
		}

		row := ParsedRow{
			Week:               week,
			SupplyChainCostAcc: scCostAcc,
			Roles:              make([]RoleStat, 0, len(csvRoles)),
		}

		for _, cr := range csvRoles {
			stat, err := parseRoleStat(record, cr, getInt, getFloat)
			if err != nil {
				return nil, fmt.Errorf("row %d role %s: %w", week, cr.dbName, err)
			}
			row.Roles = append(row.Roles, stat)
		}

		game.Rows = append(game.Rows, row)
	}

	return game, nil
}

func parseRoleStat(record []string, cr csvRoleDef, getInt func([]string, string) (int64, error), getFloat func([]string, string) (float64, error)) (RoleStat, error) {
	geti := func(col string) (int64, error) { return getInt(record, col) }
	getf := func(col string) (float64, error) { return getFloat(record, col) }

	actualOrder, err := geti(cr.actualOrderCol)
	if err != nil {
		return RoleStat{}, err
	}
	openOrders, err := geti(cr.prefix + "openOrders")
	if err != nil {
		return RoleStat{}, err
	}
	inventory, err := geti(cr.prefix + "inventory")
	if err != nil {
		return RoleStat{}, err
	}
	backorder, err := geti(cr.prefix + "backorder")
	if err != nil {
		return RoleStat{}, err
	}
	incomingDelivery, err := geti(cr.prefix + "incomingDelivery")
	if err != nil {
		return RoleStat{}, err
	}
	incomingOrder, err := geti(cr.prefix + "incomingOrder")
	if err != nil {
		return RoleStat{}, err
	}
	outgoingDelivery, err := geti(cr.prefix + "outgoingDelivery")
	if err != nil {
		return RoleStat{}, err
	}
	surplus, err := geti(cr.prefix + "surplus")
	if err != nil {
		return RoleStat{}, err
	}
	cost, err := getf("performanceControlling" + cr.prefix + "Cost")
	if err != nil {
		return RoleStat{}, err
	}
	costAcc, err := getf("performanceControlling" + cr.prefix + "CostAcc")
	if err != nil {
		return RoleStat{}, err
	}

	return RoleStat{
		Role:             cr.dbName,
		ActualOrder:      actualOrder,
		OpenOrders:       openOrders,
		Inventory:        inventory,
		Backorder:        backorder,
		IncomingDelivery: incomingDelivery,
		IncomingOrder:    incomingOrder,
		OutgoingDelivery: outgoingDelivery,
		Surplus:          surplus,
		Cost:             cost,
		CostAcc:          costAcc,
	}, nil
}
