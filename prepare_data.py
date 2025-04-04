import os, sqlite3, re, argparse
from pathlib import Path
import pandas as pd

# raw file match syntex
# {year} - Game {game_num} - {table_name}.csv
# year: alphanumeric
# game_num: numeric
# table_name: one of (orders, inventory, surplus, supply_chain_cost)

def match_raw_files(filepath):
  pattern = r"(\w+) - game (\d+) - (orders|inventory|surplus|supply_chain_cost)\.csv$"
  match = re.search(pattern, filepath)
  if match:
    match_groups = match.groups()
    return {
      "year":match_groups[0],
      "game_num":match_groups[1],
      "table_name":match_groups[2]
    }
  else:
    return None

def get_raw_files(dir):
  return [os.path.join(dir, f) for f in os.listdir(dir) if match_raw_files(f)]

def process_file(filepath):
  file_info = match_raw_files(filepath)
  table_name = file_info["table_name"]

  value_vars = ["Factory", "Retailer","Wholesaler", "Distributor"]
  if file_info["table_name"] == "orders":
    value_vars.append("Consumer")

  df = pd.read_csv(filepath)
  df= df.rename(columns={"category":"week_num"})

  if file_info["table_name"] == "supply_chain_cost":
    df= df.rename(columns={"supply_chain_cost":"value"})
    df= df.drop(["Target"], axis=1)
  else:
    df = pd.melt(
      df,
      id_vars="week_num",
      value_vars=value_vars,
      var_name="role",
      value_name="value"
    )
  
  df["year"] = file_info["year"]
  df["game_num"] = file_info["game_num"]
  
  return table_name, df

def gather_data(folder_dir):
  game_dfs = {
    "orders":[],
    "inventory":[],
    "surplus":[],
    "supply_chain_cost":[]
  }
  # get the raw files
  raw_files = get_raw_files(folder_dir)
  # process each file one by one into a df and append to the correct list in game_dfs
  for f in raw_files:
    table_name, df = process_file(f)
    game_dfs[table_name].append(df)
  return game_dfs

def write_to_df(filepath, game_dfs):
  conn = sqlite3.connect(filepath)

  for table_name in game_dfs:
    combined_df = pd.concat(game_dfs[table_name], ignore_index=True)
    combined_df.to_sql(table_name, conn, if_exists="replace", index=False)

  conn.commit()
  conn.close()

def main(RAWDIR: Path, OUTFILE: Path):
  # Add your processing logic here
  game_dfs = gather_data(RAWDIR)
  write_to_df(OUTFILE, game_dfs)

if __name__ == "__main__":
  parser = argparse.ArgumentParser(description="Process two folder paths.")
  parser.add_argument("RAWDIR", type=Path, help="Path to raw data folder")
  parser.add_argument("OUTFILE", type=Path, help="Path to output db file")

  args = parser.parse_args()

  main(args.RAWDIR, args.OUTFILE)