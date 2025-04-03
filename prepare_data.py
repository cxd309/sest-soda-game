import os, sqlite3, json, re
import pandas as pd

ROOT_DIR = os.path.expanduser("~/github/sest-soda-game/docs/static/raw-data")
OUT_DIR = os.path.expanduser("~/github/sest-soda-game/docs/static")

def match_raw_files(filepath):
  #match syntax for raw files
  # these will be of the format:
  # {year} - Game {game_num} - {table_name}.csv
  # year: alphanumeric
  # game_num: numeric
  # table_name: one of orders, inventory, surplus, supply_chain_cost
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
  # list all files in dir that match the expected syntax
  return [os.path.join(dir, f) for f in os.listdir(dir) if match_raw_files(f)]

def process_file(filepath):
  file_info = match_raw_files(filepath)
  value_vars = ["Factory", "Retailer","Wholesaler", "Distributor"]

  if file_info["table_name"] == "orders":
    value_vars.append("Consumer")
  elif file_info["table_name"] == "supply_chain_cost":
    value_vars = ["supply_chain_cost"]
  

  print(file_info)
  pass
  #return table_name, file_df


def main():
  game_dfs = {
    "orders":[],
    "inventory":[],
    "surplus":[],
    "supply_chain_cost":[]
  }
  # get the raw files
  raw_files = get_raw_files(ROOT_DIR)
  # process each file one by one into a df and append to the correct list in game_dfs
  for f in raw_files:
    res = process_file(f)
  # concat each of the game_dfs into a single df and then write to the sqlite database

main()