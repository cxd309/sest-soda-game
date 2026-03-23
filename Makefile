.PHONY: process
process:
	go run ./cmd/processor ./raw-data ./docs/static/game-data.db

.PHONY: serve
serve:
	simple-file-server ./docs 8081 sest-soda-game

.PHONY: generate
generate:
	sqlc generate
