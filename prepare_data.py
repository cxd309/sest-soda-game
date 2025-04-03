import os, sqlite3, json, re
import pandas as pd

ROOT_DIR = os.path.expanduser("~/git/sest-soda-game/docs/static/raw-data")
OUT_DIR = os.path.expanduser("~/git/sest-soda-game/docs/static")

def get_raw_files(dir):
  # list all files in dir that match the expected syntax, 
  # these will be of the format:
  # {year} - Game {game_num} - {table_name}.csv
  # year: alphanumeric
  # game_num: numeric
  # table_name: one of orders, inventory, surplus, supply_chain_cost
  file_pattern = r'^\w+ - game \d+ - (orders|inventory|surplus|supply_chain_cost)\.csv$'

  # List all files in dir that match the pattern
  return [os.path.join(dir, f) for f in os.listdir(dir) if re.match(file_pattern, f)]

def process_file(filepath):
  pass

def main():
  game_dfs = {
    "orders":[],
    "inventory":[],
    "surplus":[],
    "supply_chain_cost":[]
  }
  # get the raw files
  raw_files = get_raw_files(ROOT_DIR)
  print(raw_files)
  # process each file one by one into a df and append to the correct list in game_dfs
  
  # concat each of the game_dfs into a single df and then write to the sqlite database

main()