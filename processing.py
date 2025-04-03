import os, sqlite3, json, re
import pandas as pd

ROOT_DIR = "~/git/sest-soda-game/docs/static/raw-data"
OUT_DIR = "~/git/sest-soda-game/docs/static"

# list all files in ROOT_DIR that match the expected syntax, 
# these will be of the format:
# {year} - Game {game_num} - {table_name}.csv
# year: alphanumeric
# game_num: numeric
# table_name: one of orders, inventory, surplus, supply_chain_cost
file_pattern = r'^\w+ - Game \d+ - (orders|inventory|surplus|supply_chain_cost)\.csv$'

# List all files in ROOT_DIR that match the pattern
raw_files = [f for f in os.listdir(ROOT_DIR) if re.match(file_pattern, f)]

print(matching_files)


# Define the directory
rootDir = os.path.dirname(os.path.realpath(__file__)) + "/raw/"

# List all files in the directory
files = os.listdir(rootDir)

def process_year_folder(folderPath):
  # Organize files by type
  game_files = {
    "orders": [],
    "inventory": [],
    "surplus": [],
    "supply_chain_cost": []
  }

  # Filter files by type
  for file in files:
    if "Orders.csv" in file:
      game_files["orders"].append(file)
    elif "Inventory.csv" in file:
      game_files["inventory"].append(file)
    elif "Surplus.csv" in file:
      game_files["surplus"].append(file)
    elif "Supply Chain Cost.csv" in file:
      game_files["supply_chain_cost"].append(file)

# Function to process each file
def process_file(year, file_list, value_vars):
  all_df_list = []

  for file in file_list:
    # Load the CSV file
    df = pd.read_csv(os.path.join(rootDir, file))
    
    # Melt the DataFrame to long-form
    long_df = pd.melt(
      df, 
      id_vars=["category"], 
      value_vars=value_vars, 
      var_name="role", 
      value_name=value_name
    )

    # Extract game number from the filename (assuming file format is "Game X - *.csv")
    game_num = int(file.split(" ")[1].replace(f" - {role_names[0]}.csv", ""))
    
    # Add game_num and week_num columns
    long_df["game_num"] = game_num
    long_df["week_num"] = long_df["category"]
    long_df["year"] = year  # Add the year column

    # Reorder columns to match desired structure
    long_df = long_df[["game_num", "role", "week_num", value_name, "year"]]
    
    # Append to the list
    all_df_list.append(long_df)

  # Concatenate all DataFrames into one
  return pd.concat(all_df_list, ignore_index=True)


# Process the Orders data
combined_orders_df = process_file(
  game_files["orders"], 
  value_vars=["Factory", "Retailer", "Wholesaler", "Distributor", "Consumer"], 
  value_name="orders", 
  role_names=["Factory", "Retailer", "Wholesaler", "Distributor", "Consumer"]
)

# Process the Inventory data
combined_inventory_df = process_file(
  game_files["inventory"], 
  value_vars=["Factory", "Retailer", "Wholesaler", "Distributor"], 
  value_name="inventory", 
  role_names=["Factory", "Retailer", "Wholesaler", "Distributor"]
)

# Process the Surplus data
combined_surplus_df = process_file(
  game_files["surplus"], 
  value_vars=["Factory", "Retailer", "Wholesaler", "Distributor"], 
  value_name="surplus", 
  role_names=["Factory", "Retailer", "Wholesaler", "Distributor"]
)

# Process the Supply Chain Cost data
combined_supply_chain_cost_df = process_file(
  game_files["supply_chain_cost"], 
  value_vars=["Supply Chain Cost"], 
  value_name="supply_chain_cost", 
  role_names=["Supply Chain Cost"]
)

# Connect to SQLite Database (or create it if it doesn't exist)
db_file = year+"/game-data.db"
conn = sqlite3.connect(db_file)

# Write DataFrames to SQLite tables
combined_orders_df.to_sql("orders", conn, if_exists="replace", index=False)
combined_inventory_df.to_sql("inventory", conn, if_exists="replace", index=False)
combined_surplus_df.to_sql("surplus", conn, if_exists="replace", index=False)
combined_supply_chain_cost_df.to_sql("supply_chain_cost", conn, if_exists="replace", index=False)

# Commit changes and close the connection
conn.commit()
conn.close()

# Export to Excel with a sheet per DataFrame
excel_file = year+"/game-data.xlsx"
with pd.ExcelWriter(excel_file, engine='xlsxwriter') as writer:
  combined_orders_df.to_excel(writer, sheet_name='orders', index=False)
  combined_inventory_df.to_excel(writer, sheet_name='inventory', index=False)
  combined_surplus_df.to_excel(writer, sheet_name='surplus', index=False)
  combined_supply_chain_cost_df.to_excel(writer, sheet_name='supply_chain_cost', index=False)

# export all DataFrames to a single JSON file (as a dictionary of DataFrames)
all_data = {
  "orders": combined_orders_df.to_dict(orient="records"),
  "inventory": combined_inventory_df.to_dict(orient="records"),
  "surplus": combined_surplus_df.to_dict(orient="records"),
  "supply_chain_cost": combined_supply_chain_cost_df.to_dict(orient="records")
}

# Save the combined JSON data as a single file
with open(year+"/game-data.json", "w") as json_file:
  json.dump(all_data, json_file, indent=4)

