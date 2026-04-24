import duckdb
import os
import pandas as pd

# Конфигурация путей (как на сервере)
DATA_PATH = "/home/usman/onedrive_folder/project_data/final_df/date=2026-04-22/*.parquet"
STATUS_PATH = "/home/usman/onedrive_folder/project_data/result/unified_status.parquet"

def debug():
    if not os.path.exists(STATUS_PATH):
        print(f"ERROR: Status file not found at {STATUS_PATH}")
        return

    print("Connecting to DuckDB...")
    con = duckdb.connect(database=':memory:')
    
    print("Loading data views...")
    import glob
    files = glob.glob(DATA_PATH, recursive=True)
    if not files:
        print(f"ERROR: No files found at {DATA_PATH}")
        return
    
    first_file = files[0]
    print(f"Reading sample file: {first_file}")
    con.execute(f"CREATE VIEW sales_raw AS SELECT * FROM read_parquet('{first_file}')")
    con.execute(f"CREATE VIEW statuses_view AS SELECT * FROM read_parquet('{STATUS_PATH}')")

    # 1. Проверка уникальных типов и владельцев
    print("\n--- STATUS FILE OVERVIEW ---")
    print(con.execute("SELECT type, COUNT(*) FROM statuses_view GROUP BY 1").df())
    
    print("\nStatus owners for CLIENTS:")
    print(con.execute("SELECT DISTINCT status_owner FROM statuses_view WHERE type = 'client' LIMIT 10").df())

    print("\nStatus owners for PRODUCTS (first 10):")
    print(con.execute("SELECT DISTINCT status_owner FROM statuses_view WHERE type = 'product' LIMIT 10").df())

    # 2. Имитация фильтрации
    # Допустим, мы фильтруем по статусу 'В зоне риска' для измерения 'Product name' и конкретного владельца
    test_status = 'В зоне риска'
    test_dim = 'Product name'
    test_owner = 'KORZION | USDT'
    test_type = 'product'

    print(f"\n--- TESTING FILTER: Status='{test_status}', Dim='{test_dim}', Owner='{test_owner}' ---")

    subquery = f"""
        SELECT DISTINCT TRIM(UPPER(name)) FROM statuses_view 
        WHERE status = '{test_status}'
        AND TRIM(UPPER(status_owner)) = TRIM(UPPER('{test_owner}'))
        AND UPPER(type) = UPPER('{test_type}')
    """
    
    names_in_status = con.execute(subquery).df()
    print(f"Names found in status file for this filter: {len(names_in_status)}")
    if len(names_in_status) > 0:
        print("Sample names from status file:")
        print(names_in_status.head(5))

    # 3. Проверка пересечения с продажами
    match_query = f"""
        SELECT COUNT(*) 
        FROM sales_raw 
        WHERE TRIM(UPPER("{test_dim}")) IN ({subquery})
    """
    
    matches = con.execute(match_query).fetchone()[0]
    print(f"\nMATCHES IN SALES DATA: {matches}")

    if matches == 0:
        print("\n!!! WARNING: Zero matches found. Checking for naming discrepancies...")
        print("\nSample names from SALES data:")
        print(con.execute(f"SELECT DISTINCT \"{test_dim}\" FROM sales_raw WHERE \"{test_dim}\" IS NOT NULL LIMIT 5").df())
        
        print("\nSample names from STATUS file (any owner/type):")
        print(con.execute(f"SELECT DISTINCT name FROM statuses_view WHERE status = '{test_status}' LIMIT 5").df())

if __name__ == "__main__":
    debug()
