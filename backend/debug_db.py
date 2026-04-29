import duckdb
import os

DATA_PATH = "/home/usman/project_data/processed/final_df/**/*.parquet"
PURCHASE_DATA_PATH = "/home/usman/project_data/processed/final_df_purch/**/*.parquet"

print(f"Checking DATA_PATH: {DATA_PATH}")
print(f"Exists: {os.path.exists(DATA_PATH)}")

print(f"Checking PURCHASE_DATA_PATH: {PURCHASE_DATA_PATH}")
print(f"Exists: {os.path.exists(PURCHASE_DATA_PATH)}")

conn = duckdb.connect(':memory:')
try:
    print("\n--- Sales Check ---")
    res = conn.execute(f"SELECT COUNT(*) FROM read_parquet('{DATA_PATH}')").fetchone()
    print(f"Sales row count: {res[0]}")
    cols = conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{DATA_PATH}') LIMIT 0").fetchall()
    print(f"Sales columns: {[c[0] for c in cols]}")
except Exception as e:
    print(f"Sales error: {e}")

try:
    print("\n--- Purchase Check ---")
    res = conn.execute(f"SELECT COUNT(*) FROM read_parquet('{PURCHASE_DATA_PATH}')").fetchone()
    print(f"Purchase row count: {res[0]}")
    cols = conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{PURCHASE_DATA_PATH}') LIMIT 0").fetchall()
    print(f"Purchase columns: {[c[0] for c in cols]}")
except Exception as e:
    print(f"Purchase error: {e}")
