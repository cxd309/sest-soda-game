package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/cxd309/sest-soda-game/internal/db"
	"github.com/cxd309/sest-soda-game/internal/parser"
	_ "modernc.org/sqlite"
)

func main() {
	if len(os.Args) != 3 {
		log.Fatalf("usage: processor <raw-data-dir> <output-db>")
	}

	rawDir, outDB := os.Args[1], os.Args[2]

	schema, err := os.ReadFile("db/schema.sql")
	if err != nil {
		log.Fatalf("read schema: %v", err)
	}

	if err := os.Remove(outDB); err != nil && !os.IsNotExist(err) {
		log.Fatalf("remove %s: %v", outDB, err)
	}

	conn, err := sql.Open("sqlite", outDB)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	ctx := context.Background()

	if _, err := conn.ExecContext(ctx, string(schema)); err != nil {
		log.Fatalf("create schema: %v", err)
	}

	entries, err := os.ReadDir(rawDir)
	if err != nil {
		log.Fatalf("read dir %s: %v", rawDir, err)
	}

	q := db.New(conn)
	var processed, skipped int

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".csv" {
			continue
		}

		game, err := parser.ParseFile(filepath.Join(rawDir, entry.Name()))
		if err != nil {
			log.Printf("skip %s: %v", entry.Name(), err)
			skipped++
			continue
		}

		if err := insertGame(ctx, conn, q, game); err != nil {
			log.Fatalf("insert %s: %v", entry.Name(), err)
		}

		log.Printf("processed: %s - Game %d (%d weeks)", game.Group, game.GameNum, len(game.Rows))
		processed++
	}

	log.Printf("done: %d processed, %d skipped", processed, skipped)
}

func insertGame(ctx context.Context, conn *sql.DB, q *db.Queries, game *parser.ParsedGame) error {
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	qtx := q.WithTx(tx)

	groupID, err := qtx.UpsertGroup(ctx, game.Group)
	if err != nil {
		return fmt.Errorf("upsert group %q: %w", game.Group, err)
	}

	gameID, err := qtx.InsertGame(ctx, db.InsertGameParams{
		GroupID:               groupID,
		GameNum:               int64(game.GameNum),
		TranscentisID:         game.TranscentisID,
		TargetSurplus:         game.TargetSurplus,
		TargetRetailerCost:    game.TargetRetailerCost,
		TargetSupplyChainCost: game.TargetSupplyChainCost,
	})
	if err != nil {
		return fmt.Errorf("insert game: %w", err)
	}

	for _, row := range game.Rows {
		for _, role := range row.Roles {
			if err := qtx.InsertWeeklyStat(ctx, db.InsertWeeklyStatParams{
				GameID:           gameID,
				Week:             row.Week,
				Role:             role.Role,
				ActualOrder:      role.ActualOrder,
				OpenOrders:       role.OpenOrders,
				Inventory:        role.Inventory,
				Backorder:        role.Backorder,
				IncomingDelivery: role.IncomingDelivery,
				IncomingOrder:    role.IncomingOrder,
				OutgoingDelivery: role.OutgoingDelivery,
				Surplus:          role.Surplus,
				Cost:             role.Cost,
				CostAcc:          role.CostAcc,
			}); err != nil {
				return fmt.Errorf("insert weekly stat week %d role %s: %w", row.Week, role.Role, err)
			}
		}

		if err := qtx.InsertSupplyChainWeekly(ctx, db.InsertSupplyChainWeeklyParams{
			GameID:  gameID,
			Week:    row.Week,
			CostAcc: row.SupplyChainCostAcc,
		}); err != nil {
			return fmt.Errorf("insert supply chain week %d: %w", row.Week, err)
		}
	}

	return tx.Commit()
}
