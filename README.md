# sest-soda-game

Visualisation of results from the [Transcentis](https://www.transcentis.com/) soda game simulation, used with University of Birmingham cohorts to demonstrate system dynamics.

Deployed via GitHub Pages from the `docs/` directory.

## Prerequisites

- [Go](https://go.dev/)
- [sqlc](https://sqlc.dev/)
```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```
- [simple-file-server](https://github.com/cxd309/simple-file-server)
```bash
go install github.com/cxd309/simple-file-server@latest
```

## Usage

### Process raw data into the database

```
make process
```

Reads all CSV files from `raw-data/` and writes `docs/static/game-data.db`.

Run this whenever new game data is added to `raw-data/`.

### Serve locally

```
make serve
```

Serves the site at [http://localhost:8081/sest-soda-game/](http://localhost:8081/sest-soda-game/), replicating the GitHub Pages path structure.

### Regenerate sqlc code

```
make generate
```

Run after modifying files in `db/` directory.

## Raw data

CSV files in `raw-data/` are exported directly from Transcentis. Filename format:

```
{Group} - Game {N}.csv
```

e.g. `SEST 2026 Round 1 - Game 3.csv`
