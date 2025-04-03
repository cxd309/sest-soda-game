import os, sqlite3, json, re
import pandas as pd

ROOT_DIR = os.path.expanduser("~/git/sest-soda-game/docs/static/raw-data")
OUT_DIR = os.path.expanduser("~/git/sest-soda-game/docs/static")

def Get_Raw_Files(dir):
  # list all files in dir that match the expected syntax, 
  # these will be of the format:
  # {year} - Game {game_num} - {table_name}.csv
  # year: alphanumeric
  # game_num: numeric
  # table_name: one of orders, inventory, surplus, supply_chain_cost
  file_pattern = r'^\w+ - game \d+ - (orders|inventory|surplus|supply_chain_cost)\.csv$'

  # List all files in dir that match the pattern
  return [f for f in os.listdir(dir) if re.match(file_pattern, f)]

print(Get_Raw_Files(ROOT_DIR))