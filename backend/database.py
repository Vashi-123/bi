import duckdb
import os
import json
import re
import glob
from datetime import datetime
import pandas
import time
import logging
from threading import Lock

logger = logging.getLogger(__name__)

# Input validation
DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')
DATE_FILTER_KEYS = {'dateMode', 'startDate', 'endDate', 'relativeValue', 'relativeUnit'}
ALLOWED_COLUMNS = {'type', 'Category', 'Currency', 'counterparty', 'Groupclient', 'Product country', 'CountryGroup', 'Product name'}

def validate_date(date_str: str) -> bool:
    """Returns True if date_str matches YYYY-MM-DD format."""
    return bool(date_str and DATE_PATTERN.match(date_str))

def extract_column_filters(filters: dict) -> dict:
    """Separates column filters from date filter parameters."""
    return {k: v for k, v in filters.items() if k not in DATE_FILTER_KEYS}

# Path to the partitioned parquet dataset
# Use environment variable DATA_PATH if available, else default to absolute path on server
DATA_PATH = os.getenv("DATA_PATH", "/home/usman/project_data/processed/final_df/**/*.parquet")
PURCHASE_DATA_PATH = os.getenv("PURCHASE_DATA_PATH", "/home/usman/project_data/processed/final_df_purch/**/*.parquet")
STATUS_PATH = os.getenv("STATUS_PATH", "/home/usman/project_data/result/unified_status.parquet")

# Global connection and cache
_CONN = None
_CACHE = {}
_CACHE_LOCK = Lock()
CACHE_TTL = 300  # 5 minutes
GROUPS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "groups.json")
STOCK_SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stock_settings.json")

def get_connection():
    global _CONN
    if _CONN is None:
        # Initialize one global connection
        _CONN = duckdb.connect(database=':memory:')
        try:
            # Load into actual TABLE for speed (uses RAM)
            logger.info("Loading sales data into memory...")
            start_load = time.time()
            
            # Load SALES data
            max_row_s = _CONN.execute(f"SELECT MAX(date) FROM read_parquet('{DATA_PATH}')").fetchone()
            if max_row_s and max_row_s[0]:
                max_date_s = max_row_s[0]
                _CONN.execute(f"""
                    CREATE OR REPLACE TABLE sales_raw AS 
                    SELECT * FROM read_parquet('{DATA_PATH}') 
                    WHERE CAST(date AS DATE) >= CAST('{max_date_s}' AS DATE) - INTERVAL '6 month'
                """)
                logger.info(f"Loaded sales data into RAM. Window: 6 months from {max_date_s}")
            else:
                _CONN.execute(f"CREATE OR REPLACE TABLE sales_raw AS SELECT * FROM read_parquet('{DATA_PATH}')")

            # Load PURCHASE data
            if os.path.exists(PURCHASE_DATA_PATH):
                try:
                    max_row_p = _CONN.execute(f"SELECT MAX(date) FROM read_parquet('{PURCHASE_DATA_PATH}')").fetchone()
                    if max_row_p and max_row_p[0]:
                        max_date_p = max_row_p[0]
                        _CONN.execute(f"""
                            CREATE OR REPLACE TABLE purchase_raw AS 
                            SELECT * FROM read_parquet('{PURCHASE_DATA_PATH}') 
                            WHERE CAST(date AS DATE) >= CAST('{max_date_p}' AS DATE) - INTERVAL '6 month'
                        """)
                        logger.info(f"Loaded purchase data into RAM. Window: 6 months from {max_date_p}")
                    else:
                        _CONN.execute(f"CREATE OR REPLACE TABLE purchase_raw AS SELECT * FROM read_parquet('{PURCHASE_DATA_PATH}')")
                except Exception as p_err:
                    logger.warning(f"Could not load purchase data: {p_err}")
                    _CONN.execute("CREATE TABLE IF NOT EXISTS purchase_raw AS SELECT * FROM sales_raw LIMIT 0")
            else:
                # Empty table if path doesn't exist
                _CONN.execute("CREATE TABLE IF NOT EXISTS purchase_raw AS SELECT * FROM sales_raw LIMIT 0")
            
            # Load custom groups
            refresh_groups_table()

            # Create an in-memory TABLE for statuses
            if os.path.exists(STATUS_PATH):
                _CONN.execute(f"CREATE OR REPLACE TABLE statuses_view AS SELECT * FROM read_parquet('{STATUS_PATH}')")
            elif os.path.exists("unified_status.parquet"):
                _CONN.execute("CREATE OR REPLACE TABLE statuses_view AS SELECT * FROM read_parquet('unified_status.parquet')")
            
            logger.info("Database initialized with in-memory tables.")

        except Exception as e:
            logger.error(f"Critical error during DB initialization: {e}")
            # Fallback: create tables as views if memory load failed
            _CONN.execute(f"CREATE TABLE IF NOT EXISTS sales_raw AS SELECT * FROM read_parquet('{DATA_PATH}') LIMIT 0")
            _CONN.execute("CREATE TABLE IF NOT EXISTS custom_groups (counterparty VARCHAR, group_name VARCHAR)")
            _CONN.execute("CREATE TABLE IF NOT EXISTS custom_country_groups (country_code VARCHAR, group_name VARCHAR)")
    return _CONN

def refresh_groups_table():
    """Loads groups from JSON and refreshes the DuckDB 'groups' table and 'sales' view."""
    conn = get_connection()
    data = load_groups()
    
    # 1. Counterparty Groups
    cp_groups = data.get('counterparties', {})
    cp_flattened = []
    for gname, counterparties in cp_groups.items():
        for cp in counterparties:
            cp_flattened.append({'counterparty': cp.strip().lower(), 'group_name': gname})
    
    conn.execute("CREATE TABLE IF NOT EXISTS custom_groups (counterparty VARCHAR, group_name VARCHAR)")
    conn.execute("DELETE FROM custom_groups")
    if cp_flattened:
        df_cp = pandas.DataFrame(cp_flattened)
        conn.execute("INSERT INTO custom_groups SELECT * FROM df_cp")

    # 2. Country Groups
    country_groups = data.get('countries', {})
    country_flattened = []
    for gname, codes in country_groups.items():
        for code in codes:
            country_flattened.append({'country_code': code.strip().upper(), 'group_name': gname})
    
    conn.execute("CREATE TABLE IF NOT EXISTS custom_country_groups (country_code VARCHAR, group_name VARCHAR)")
    conn.execute("DELETE FROM custom_country_groups")
    if country_flattened:
        df_c = pandas.DataFrame(country_flattened)
        conn.execute("INSERT INTO custom_country_groups SELECT * FROM df_c")
    
    # 3. Create Enriched Views dynamically
    for table_type in ['sales', 'purchase']:
        raw_name = f"{table_type}_raw"
        try:
            col_res = conn.execute(f"DESCRIBE {raw_name}").fetchall()
            existing_cols = [row[0] for row in col_res]
        except:
            existing_cols = []

        exclude_cols = []
        if "Groupclient" in existing_cols: exclude_cols.append("Groupclient")
        if "CountryGroup" in existing_cols: exclude_cols.append("CountryGroup")
        exclude_clause = f"EXCLUDE ({', '.join(exclude_cols)})" if exclude_cols else ""

        gc_fallback = "s.Groupclient" if "Groupclient" in existing_cols else "NULL"
        cg_fallback = "s.CountryGroup" if "CountryGroup" in existing_cols else "NULL"
        
        conn.execute(f"""
            CREATE OR REPLACE VIEW {table_type} AS 
            SELECT 
                s.* {exclude_clause},
                COALESCE({gc_fallback}, s.counterparty) as Groupclient,
                COALESCE({cg_fallback}, 'Other') as CountryGroup
            FROM {raw_name} s
        """)

def refresh_in_memory_data():
    """Forces a reload of parquet files into the in-memory tables."""
    conn = get_connection()
    start_load = time.time()
    
    # 1. Reload Sales Data
    max_row = conn.execute(f"SELECT MAX(date) FROM read_parquet('{DATA_PATH}')").fetchone()
    if max_row and max_row[0]:
        max_date = max_row[0]
        conn.execute(f"""
            CREATE OR REPLACE TABLE sales_raw AS 
            SELECT * FROM read_parquet('{DATA_PATH}') 
            WHERE CAST(date AS DATE) >= CAST('{max_date}' AS DATE) - INTERVAL '6 month'
        """)
    
    # 2. Reload Purchase Data
    max_row_p = conn.execute(f"SELECT MAX(date) FROM read_parquet('{PURCHASE_DATA_PATH}')").fetchone()
    if max_row_p and max_row_p[0]:
        max_date_p = max_row_p[0]
        conn.execute(f"""
            CREATE OR REPLACE TABLE purchase_raw AS 
            SELECT * FROM read_parquet('{PURCHASE_DATA_PATH}') 
            WHERE CAST(date AS DATE) >= CAST('{max_date_p}' AS DATE) - INTERVAL '6 month'
        """)
    
    # 2. Reload Statuses
    if os.path.exists(STATUS_PATH):
        conn.execute(f"CREATE OR REPLACE TABLE statuses_view AS SELECT * FROM read_parquet('{STATUS_PATH}')")
    elif os.path.exists("unified_status.parquet"):
        conn.execute("CREATE OR REPLACE TABLE statuses_view AS SELECT * FROM read_parquet('unified_status.parquet')")
        
    # 3. Re-apply groups and views
    refresh_groups_table()
    
    logger.info(f"HOT REFRESH: Data reloaded into RAM in {time.time() - start_load:.2f}s")
    return True

def load_groups():
    if not os.path.exists(GROUPS_FILE):
        return {"counterparties": {}, "countries": {}}
    try:
        with open(GROUPS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Support both old and new format during transition
            if "counterparties" not in data and "countries" not in data:
                return {"counterparties": data, "countries": {}}
            return data
    except Exception as e:
        logger.error(f"Error loading groups: {e}")
        return {"counterparties": {}, "countries": {}}

def save_groups(data):
    try:
        with open(GROUPS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        refresh_groups_table()
        return True
    except Exception as e:
        logger.error(f"Error saving groups: {e}")
        return False

# --- Stock Settings Management ---

def load_stock_settings():
    if not os.path.exists(STOCK_SETTINGS_FILE):
        return {"monitored_skus": [], "authorized_users": [], "notification_recipients": []}
    try:
        with open(STOCK_SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading stock settings: {e}")
        return {"monitored_skus": [], "authorized_users": [], "notification_recipients": []}

def save_stock_settings(data):
    try:
        with open(STOCK_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving stock settings: {e}")
        return False

def get_unique_items():
    """Returns all unique items (sku/product) for stock monitoring from df_product (catalog)."""
    cursor = get_cursor()
    
    # Path to product catalog (more comprehensive than df_stock)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PRODUCT_DATA_PATH = os.path.join(base_dir, "..", "onedrive_folder", "project_data", "df_product", "**", "*.parquet")
    STOCK_DATA_PATH = os.path.join(base_dir, "..", "onedrive_folder", "project_data", "df_stock", "**", "*.parquet")
    
    # Try df_product first, fallback to df_stock
    target_path = None
    if any(glob.glob(PRODUCT_DATA_PATH, recursive=True)):
        target_path = PRODUCT_DATA_PATH
        logger.info(f"Using df_product as item source: {target_path}")
    elif any(glob.glob(STOCK_DATA_PATH, recursive=True)):
        target_path = STOCK_DATA_PATH
        logger.info(f"Fallback to df_stock as item source: {target_path}")

    if not target_path:
        # Final fallback for local development or missing folders
        target_path = "./project_data/df_product/**/*.parquet"

    try:
        # We query for the most comprehensive list of items
        query = f"""
            SELECT DISTINCT item_id, item_name 
            FROM read_parquet('{target_path}')
            WHERE item_id IS NOT NULL AND item_name IS NOT NULL
            ORDER BY 2
        """
        res = cursor.execute(query).fetchall()
        return [{"id": str(r[0]), "name": str(r[1])} for r in res]
    except Exception as e:
        logger.error(f"Error in get_unique_items from {target_path}: {e}")
        # Fallback to current memory table sales_raw if parquet is unavailable
        try:
            query = 'SELECT DISTINCT "Item name", "Item name" FROM sales_raw WHERE "Item name" IS NOT NULL ORDER BY 1'
            res = cursor.execute(query).fetchall()
            return [{"id": str(r[0]), "name": str(r[1])} for r in res]
        except:
            return []

def get_unique_counterparties(table_name='sales'):
    """Returns all unique counterparties from the raw dataset."""
    cursor = get_cursor()
    raw_table = f"{table_name}_raw"
    res = cursor.execute(f"SELECT DISTINCT counterparty FROM {raw_table} WHERE counterparty IS NOT NULL ORDER BY 1").fetchall()
    return [r[0] for r in res]

def get_unique_countries(table_name='sales'):
    """Returns all unique country codes from the raw dataset."""
    cursor = get_cursor()
    raw_table = f"{table_name}_raw"
    res = cursor.execute(f"SELECT DISTINCT \"Product country\" FROM {raw_table} WHERE \"Product country\" IS NOT NULL ORDER BY 1").fetchall()
    return [r[0] for r in res]

def get_cursor():
    """Returns a thread-local cursor from the global connection."""
    return get_connection().cursor()

def get_cached_data(key: str):
    with _CACHE_LOCK:
        if key in _CACHE:
            val, ts = _CACHE[key]
            if time.time() - ts < CACHE_TTL:
                return val
        return None

def set_cached_data(key: str, val: any):
    with _CACHE_LOCK:
        _CACHE[key] = (val, time.time())

def get_current_window(filters, table_name='sales'):
    cursor = get_cursor()
    max_res = cursor.execute(f"SELECT MAX(date) FROM {table_name}").fetchone()
    if not max_res or not max_res[0]: return None, None
    max_d = max_res[0]

    mode = filters.get('dateMode', 'all')
    if mode == 'all':
        min_d = cursor.execute(f"SELECT MIN(date) FROM {table_name}").fetchone()[0]
        return min_d.strftime('%Y-%m-%d'), max_d.strftime('%Y-%m-%d')
    
    if mode == 'between':
        return filters.get('startDate'), filters.get('endDate')
    
    if mode == 'relative':
        val = int(filters.get('relativeValue', 3))
        unit = filters.get('relativeUnit', 'month')
        
        # Ensure max_d is a datetime object for calculations
        max_dt = pandas.to_datetime(max_d)
        
        if unit == 'month':
            # Alignment: Start from the 1st of the month (val-1) months ago
            # e.g. if today is April 24 and val=3, we want Feb 1st
            start_dt = (max_dt.replace(day=1) - pandas.DateOffset(months=val - 1))
        elif unit == 'week':
            # Alignment: Start from the Monday of the week (val-1) weeks ago
            # max_dt.weekday() is 0 for Monday
            start_dt = (max_dt - pandas.Timedelta(days=max_dt.weekday())) - pandas.Timedelta(weeks=val - 1)
        else:
            # For days, we just take the last X days including today
            start_dt = max_dt - pandas.Timedelta(days=val - 1)
        
        res_s, res_e = start_dt.strftime('%Y-%m-%d'), max_dt.strftime('%Y-%m-%d')
        logger.info(f"DEBUG WINDOW: {mode} {val} {unit} -> {res_s} to {res_e}")
        return res_s, res_e
    
    return filters.get('startDate'), filters.get('endDate')

def get_prev_window(filters, table_name='sales'):
    s, e = get_current_window(filters, table_name=table_name)
    if not s or not e: return None, None
    
    start_dt = pandas.to_datetime(s)
    end_dt = pandas.to_datetime(e)
    duration = end_dt - start_dt
    
    prev_end = (start_dt - pandas.Timedelta(days=1))
    prev_start = (prev_end - duration)
    
    return prev_start.strftime('%Y-%m-%d'), prev_end.strftime('%Y-%m-%d')

def format_period_label(start, end):
    if not start or not end: return "All Time"
    s = pandas.to_datetime(start)
    e = pandas.to_datetime(end)
    if s.year == e.year:
        if s.month == e.month: return s.strftime('%b %Y')
        return f"{s.strftime('%b')} - {e.strftime('%b %Y')}"
    return f"{s.strftime('%b %Y')} - {e.strftime('%b %Y')}"

def get_kpi_data(filters=None, table_name='sales'):
    if not filters: filters = {}
    cursor = get_cursor()
    
    mode = filters.get('dateMode', 'all')
    curr_s, curr_e = get_current_window(filters, table_name=table_name)
    prev_s, prev_e = get_prev_window(filters, table_name=table_name)
    
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    # Determine columns based on table
    if table_name == 'purchase':
        revenue_col = "Amount_USD"
        profit_col = "0"
        margin_col = "0"
        qty_col = "Qty"
    else:
        revenue_col = "Amount_USD"
        profit_col = "Profit_USD"
        margin_col = "\"Margin_%\""
        qty_col = "Qty"

    # 1. Base query depends on mode
    if mode == 'all':
        # Truly all data, no date filter
        curr_query = f"SELECT SUM({revenue_col}), SUM({profit_col}), AVG({margin_col}), SUM({qty_col}) FROM {table_name} WHERE 1=1 {extra_filters}"
        curr_label = "All Time"
        p_res = [0, 0, 0, 0]
        prev_label = None
    else:
        # Filtered period
        curr_query = f"SELECT SUM({revenue_col}), SUM({profit_col}), AVG({margin_col}), SUM({qty_col}) FROM {table_name} WHERE CAST(date AS DATE) >= '{curr_s}' AND CAST(date AS DATE) <= '{curr_e}' {extra_filters}"
        curr_label = format_period_label(curr_s, curr_e)
        
        # Comparison logic
        p_res = [0, 0, 0, 0]
        prev_label = None
        if prev_s and prev_e:
            prev_query = f"SELECT SUM({revenue_col}), SUM({profit_col}), AVG({margin_col}), SUM({qty_col}) FROM {table_name} WHERE CAST(date AS DATE) >= '{prev_s}' AND CAST(date AS DATE) <= '{prev_e}' {extra_filters}"
            p_res = cursor.execute(prev_query).fetchone()
            # If query returns None for all (which fetchone might do if no rows match), p_res might be [None, None, None, None]
            if p_res is None: p_res = [0, 0, 0, 0]
            prev_label = format_period_label(prev_s, prev_e)
    
    c_res = cursor.execute(curr_query).fetchone()
    
    def calc_growth(curr, prev):
        if not prev or prev == 0: return 0
        return ((curr - prev) / prev) * 100

    return {
        "revenue": {"value": c_res[0] or 0, "prev": p_res[0] or 0, "growth": calc_growth(c_res[0] or 0, p_res[0] or 0)},
        "profit": {"value": c_res[1] or 0, "prev": p_res[1] or 0, "growth": calc_growth(c_res[1] or 0, p_res[1] or 0)},
        "margin": {"value": c_res[2] or 0, "prev": p_res[2] or 0, "growth": calc_growth(c_res[2] or 0, p_res[2] or 0)},
        "qty": {"value": c_res[3] or 0, "prev": p_res[3] or 0, "growth": calc_growth(c_res[3] or 0, p_res[3] or 0)},
        "meta": {
            "current_period": curr_label,
            "prev_period": prev_label
        }
    }

def get_unified_statuses(filters=None):
    """Fetches statuses from unified_status.parquet based on filters."""
    if not os.path.exists(STATUS_PATH):
        # Fallback for local dev if file isn't at the server path
        local_path = "unified_status.parquet"
        if not os.path.exists(local_path):
            return {}
        path = local_path
    else:
        path = STATUS_PATH

def get_unified_statuses(filters=None):
    """Fetches statuses from unified_status.parquet based on filters."""
    if not os.path.exists(STATUS_PATH):
        # Fallback for local dev if file isn't at the server path
        local_path = "unified_status.parquet"
        if not os.path.exists(local_path):
            return {}
        path = local_path
    else:
        path = STATUS_PATH

    # Determine status_owner
    owner = get_status_owner(filters)

    try:
        cursor = get_connection().cursor()
        # Escaping single quotes in owner name
        clean_owner = str(owner).replace("'", "''")
        # Use in-memory table statuses_view
        query = f"SELECT name, status FROM statuses_view WHERE status_owner = '{clean_owner}'"
        rows = cursor.execute(query).fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception as e:
        logger.error(f"Error fetching statuses: {e}")
        return {}

def get_status_owner(filters):
    """Determines the owner context for statuses based on current filters."""
    owner = 'all'
    if filters:
        # Filters from frontend are often lists
        f_client = filters.get('Groupclient') or filters.get('client') or filters.get('counterparty')
        f_product = filters.get('Product name')
        
        if f_client and isinstance(f_client, list) and len(f_client) == 1:
            owner = f_client[0]
        elif f_client and isinstance(f_client, str):
            owner = f_client
        elif f_product and isinstance(f_product, list) and len(f_product) == 1:
            owner = f_product[0]
        elif f_product and isinstance(f_product, str):
            owner = f_product
    return owner

def build_filter_clause(filters, prefix="WHERE", dimension=None):
    """Dynamically builds a WHERE clause based on the provided filters dictionary."""
    if not filters:
        return ""
    
    clauses = []
    status_owner = get_status_owner(filters)

    for col, values in filters.items():
        if not values or col in DATE_FILTER_KEYS:
            continue
        
        # Handle status filtering
        if col == 'status':
            try:
                # Handle cases where status might be a JSON-encoded string like '["status"]'
                if isinstance(values, str) and values.startswith('['):
                    val_list = json.loads(values)
                else:
                    val_list = values if isinstance(values, list) else [values]
                
                if not val_list or not dimension: continue
                
                # Implementation of global status filtering:
                clean_vals = [str(v).replace("'", "''") for v in val_list]
                st_list_str = ', '.join([f"'{v}'" for v in clean_vals])
                
                # Subquery for Products (Using in-memory statuses_view)
                prod_owner = status_owner
                prod_subquery = f"""
                    SELECT DISTINCT name FROM statuses_view
                    WHERE status IN ({st_list_str})
                    AND status_owner = '{prod_owner.replace("'", "''")}'
                    AND type = 'PRODUCT'
                """
                
                # Subquery for Clients (Using in-memory statuses_view)
                client_subquery = f"""
                    SELECT DISTINCT name FROM statuses_view
                    WHERE status IN ({st_list_str})
                    AND status_owner = 'all'
                    AND type = 'CLIENT'
                """
                
                st_clauses = []
                if dimension in ['Product name', 'Item name'] or dimension == 'Category':
                    st_clauses.append(f"TRIM(UPPER(\"Product name\")) IN ({prod_subquery})")
                
                if dimension == 'counterparty' or dimension == 'Category':
                    st_clauses.append(f"TRIM(UPPER(\"counterparty\")) IN ({client_subquery})")
                
                if st_clauses:
                    status_sql = "AND (" + " OR ".join(st_clauses) + ")"
                    logger.info(f"STATUS FILTER APPLIED: status={val_list}, owner={prod_owner}, dimension={dimension}")
                    clauses.append(status_sql)
                else:
                    logger.warning(f"STATUS FILTER SKIPPED: dimension {dimension} not handled for status filtering")
            except Exception as e:
                logger.error(f"CRITICAL ERROR in status filtering: {e}")
            continue

        # Handle custom Groupclient filtering via subquery
        if col == 'Groupclient':
            clean_vals = [str(v).replace("'", "''") for v in values]
            list_str = ', '.join([f"'{v}'" for v in clean_vals])
            clauses.append(f"""
                AND (
                    LOWER(TRIM(counterparty)) IN (SELECT counterparty FROM custom_groups WHERE group_name IN ({list_str}))
                    OR "{col}" IN ({list_str})
                )
            """)
            continue

        # Handle custom CountryGroup filtering via subquery
        if col == 'CountryGroup':
            clean_vals = [str(v).replace("'", "''") for v in values]
            list_str = ', '.join([f"'{v}'" for v in clean_vals])
            clauses.append(f"""
                AND (
                    UPPER(TRIM("Product country")) IN (SELECT country_code FROM custom_country_groups WHERE group_name IN ({list_str}))
                    OR "{col}" IN ({list_str})
                )
            """)
            continue

        if isinstance(values, list):
            clean_values = [str(v).replace("'", "''") for v in values]
            clauses.append(f"AND \"{col}\" IN ({', '.join([f"'{v}'" for v in clean_values])})")
        else:
            clean_value = str(values).replace("'", "''")
            clauses.append(f"AND \"{col}\" = '{clean_value}'")
    
    if not clauses:
        return ""
    
    combined = " ".join(clauses)
    if combined.startswith("AND"):
        return f"{prefix} 1=1 {combined}"
    return f"{prefix} {combined}"

def build_date_filter_clause(filters):
    """Builds a date-specific SQL clause based on the dateFilter parameters."""
    mode = filters.get('dateMode', 'all')
    if mode == 'all' or not mode:
        return ""
    
    start = filters.get('startDate')
    end = filters.get('endDate')
    rel_val = filters.get('relativeValue')
    rel_unit = filters.get('relativeUnit', 'day')
    
    # Validate date inputs before using in SQL
    if start and not validate_date(start):
        logger.warning(f"Invalid startDate format: {start}")
        start = None
    if end and not validate_date(end):
        logger.warning(f"Invalid endDate format: {end}")
        end = None
    
    # Get data max date for relative filtering
    _, end_date = get_current_window(filters)
    
    clause = ""
    if mode == 'between' and start and end:
        clause = f"AND CAST(date AS DATE) BETWEEN '{start}' AND '{end}'"
    elif mode == 'before' and end:
        clause = f"AND CAST(date AS DATE) <= '{end}'"
    elif mode == 'after' and start:
        clause = f"AND CAST(date AS DATE) >= '{start}'"
    elif mode == 'relative':
        s, e = get_current_window(filters)
        if s and e:
            clause = f"AND CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}'"
    
    if mode != 'all':
        logger.debug(f"Date Filter Mode: {mode}, Clause: '{clause}'")
    return clause

def get_filter_options(dimension, search=None, table_name='sales'):
    """Returns a list of unique values for a given dimension column with optional search."""
    cache_key = f"filter_options_{table_name}_{dimension}_{search}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    
    # Handle custom group dimensions
    if dimension == 'Groupclient':
        query = "SELECT DISTINCT group_name FROM custom_groups"
        if search:
            s_val = str(search).replace("'", "''")
            query += f" WHERE group_name ILIKE '%{s_val}%'"
        
        query += f" UNION SELECT DISTINCT Groupclient FROM {table_name} WHERE Groupclient IS NOT NULL"
        if search:
            s_val = str(search).replace("'", "''")
            query += f" AND Groupclient ILIKE '%{s_val}%'"

    elif dimension == 'CountryGroup':
        query = "SELECT DISTINCT group_name FROM custom_country_groups"
        if search:
            s_val = str(search).replace("'", "''")
            query += f" WHERE group_name ILIKE '%{s_val}%'"
        
        query += f" UNION SELECT DISTINCT CountryGroup FROM {table_name} WHERE CountryGroup IS NOT NULL"
        if search:
            s_val = str(search).replace("'", "''")
            query += f" AND CountryGroup ILIKE '%{s_val}%'"
    else:
        where_clause = f"WHERE \"{dimension}\" IS NOT NULL"
        if search:
            clean_search = str(search).replace("'", "''")
            where_clause += f" AND \"{dimension}\" ILIKE '%{clean_search}%'"
        query = f"SELECT DISTINCT \"{dimension}\" FROM {table_name} {where_clause} ORDER BY 1 ASC LIMIT 5000"

    try:
        res = cursor.execute(query).fetchall()
        out = [row[0] for row in res if row[0] is not None]
        set_cached_data(cache_key, out)
        return out
    except Exception as e:
        logger.error(f"Error getting filter options for {dimension}: {e}")
        return []

_OVERALL_DATE_RANGE = None

def get_overall_date_range(table_name='sales'):
    """Returns the absolute min and max dates in the dataset. Cached after first call."""
    cursor = get_cursor()
    res = cursor.execute(f"SELECT MIN(CAST(date AS DATE)), MAX(CAST(date AS DATE)) FROM {table_name}").fetchone()
    return {"min": str(res[0]) if res[0] else None, "max": str(res[1]) if res[1] else None}

def get_trends(metric='revenue', dimension='Category', top_n=5, interval='day', filters=None, table_name='sales'):
    if not filters: filters = {}
    logger.debug(f"Trends request filters: {filters}")
    cache_key = f"trends_{table_name}_{metric}_{dimension}_{top_n}_{interval}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    start_date, end_date = get_current_window(filters, table_name=table_name)
    if not start_date: return []

    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    if table_name == 'purchase':
        metric_map['profit'] = '0'
        metric_map['margin'] = '0'
    col = metric_map.get(metric, metric)
    
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND", dimension=dimension)
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        # Fallback to current window window if no filter (already restricted by START/END above)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{start_date}' AND CAST(date AS DATE) <= '{end_date}' {extra_filters}"

    # 1. Find Top N categories
    top_n_query = f"SELECT \"{dimension}\" FROM {table_name} {filter_clause} AND \"{dimension}\" IS NOT NULL GROUP BY 1 ORDER BY SUM({col}) DESC LIMIT {top_n}"
    top_dims = [row[0] for row in cursor.execute(top_n_query).fetchall()]
    if not top_dims: return []

    # 2. Configure Calendar aggregation
    if interval == 'day':
        cal_gen = f"SELECT CAST(generate_series AS DATE) as d FROM generate_series(CAST('{start_date}' AS DATE), CAST('{end_date}' AS DATE), interval '1 day')"
        sales_d = "date"
    elif interval == 'week':
        cal_gen = f"SELECT CAST(generate_series AS DATE) as d FROM generate_series(date_trunc('week', CAST('{start_date}' AS DATE)), date_trunc('week', CAST('{end_date}' AS DATE)), interval '7 day')"
        sales_d = "date_trunc('week', date)"
    elif interval == 'month':
        cal_gen = f"SELECT CAST(generate_series AS DATE) as d FROM generate_series(date_trunc('month', CAST('{start_date}' AS DATE)), date_trunc('month', CAST('{end_date}' AS DATE)), interval '1 month')"
        sales_d = "date_trunc('month', CAST(date AS DATE))"

    top_dims_escaped = [d.replace("'", "''") for d in top_dims]
    dim_expr = f"CASE WHEN \"{dimension}\" IN ({', '.join([f"'{d}'" for d in top_dims_escaped])}) THEN \"{dimension}\" ELSE 'Other' END"
    
    query = f"""
    WITH calendar AS ({cal_gen}),
    dims AS (SELECT unnest([{', '.join([f"'{d}'" for d in top_dims_escaped + ['Other']])}]) as dim_val),
    full_grid AS (SELECT c.d, d.dim_val FROM calendar c, dims d),
    sales_agg AS (
        SELECT CAST({sales_d} AS DATE) as cal_d, {dim_expr} as dim_val, SUM({col}) as val
        FROM {table_name} {filter_clause} GROUP BY 1, 2
    )
    SELECT f.d as sort_key, f.dim_val as dimension_value, COALESCE(s.val, 0) as value
    FROM full_grid f LEFT JOIN sales_agg s ON f.d = s.cal_d AND f.dim_val = s.dim_val
    ORDER BY sort_key ASC
    """
    try:
        df = cursor.execute(query).df()
    except Exception as e:
        logger.error(f"SQL error in get_trends: {e}\nQuery: {query}")
        return []
    
    def format_label(row):
        d = row['sort_key']
        if interval == 'day': return d.strftime('%d.%m')
        elif interval == 'week':
            end = d + pandas.Timedelta(days=6)
            return f"{d.strftime('%d.%m')}-{end.strftime('%d.%m')}"
        elif interval == 'month': return d.strftime('%b %Y')
        return str(d)

    df['time_label'] = df.apply(format_label, axis=1)
    # Add a raw ISO date for stable parsing in AI Analysis
    df['date'] = df['sort_key'].apply(lambda x: x.strftime('%Y-%m-%d') if hasattr(x, 'strftime') else str(x))
    df = df.where(pandas.notnull(df), None)
    out = df.to_dict(orient='records')
    
    # Fetch statuses for the dimensions in this trend
    statuses = get_unified_statuses(filters)
    
    final_output = {"data": out, "statuses": statuses}
    set_cached_data(cache_key, final_output)
    return final_output

def get_distribution(metric='revenue', dimension='Category', top_n=5, filters=None, table_name='sales'):
    cache_key = f"dist_{table_name}_{metric}_{dimension}_{top_n}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    if table_name == 'purchase':
        metric_map['profit'] = '0'
        metric_map['margin'] = '0'
    col = metric_map.get(metric, metric)
    
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND", dimension=dimension)
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        s, e = get_current_window(filters, table_name=table_name)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}' {extra_filters}"

    top_n_query = f"SELECT \"{dimension}\" FROM {table_name} {filter_clause} AND \"{dimension}\" IS NOT NULL GROUP BY 1 ORDER BY SUM({col}) DESC LIMIT {top_n}"
    top_dims = [row[0] for row in cursor.execute(top_n_query).fetchall()]
    if not top_dims: return []

    top_dims_escaped = [d.replace("'", "''") for d in top_dims]
    dim_expr = f"CASE WHEN \"{dimension}\" IN ({', '.join([f"'{d}'" for d in top_dims_escaped])}) THEN \"{dimension}\" ELSE 'Other' END"
    query = f"SELECT {dim_expr} as dimension_value, SUM({col}) as value FROM {table_name} {filter_clause} GROUP BY 1 ORDER BY value DESC"
    
    df = cursor.execute(query).df()
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out

def get_master_table(dimension='Category', filters=None, table_name='sales'):
    cache_key = f"master_{table_name}_{dimension}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND", dimension=dimension)
    mode = filters.get('dateMode', 'all') if filters else 'all'
    
    if mode == 'all':
        curr_filter = f"WHERE 1=1 {extra_filters}"
        prev_filter = "WHERE 1=0"
    else:
        curr_s, curr_e = get_current_window(filters, table_name=table_name)
        prev_s, prev_e = get_prev_window(filters, table_name=table_name)
        curr_filter = f"WHERE CAST(date AS DATE) >= '{curr_s}' AND CAST(date AS DATE) <= '{curr_e}' {extra_filters}"
        if prev_s and prev_e:
            prev_filter = f"WHERE CAST(date AS DATE) >= '{prev_s}' AND CAST(date AS DATE) <= '{prev_e}' {extra_filters}"
        else:
            prev_filter = "WHERE 1=0"
    
    # Determine columns based on table
    if table_name == 'purchase':
        revenue_col = "Amount_USD"
        profit_col = "0"
        margin_col = "0"
        qty_col = "Qty"
    else:
        revenue_col = "Amount_USD"
        profit_col = "Profit_USD"
        margin_col = "\"Margin_%\""
        qty_col = "Qty"

    query = f"""
    WITH curr AS (
        SELECT "{dimension}" as name, SUM({revenue_col}) as revenue, SUM({profit_col}) as profit, AVG({margin_col}) as margin, SUM({qty_col}) as qty 
        FROM {table_name} {curr_filter} GROUP BY 1
    ),
    prev AS (
        SELECT "{dimension}" as name, SUM({revenue_col}) as revenue, SUM({profit_col}) as profit, AVG({margin_col}) as margin, SUM({qty_col}) as qty 
        FROM {table_name} {prev_filter} GROUP BY 1
    )
    SELECT 
        c.name, 
        c.revenue, c.profit, c.margin, c.qty,
        CASE WHEN p.revenue IS NULL OR p.revenue = 0 THEN 0 ELSE ((c.revenue - p.revenue) / p.revenue) * 100 END as revenue_growth,
        CASE WHEN p.profit IS NULL OR p.profit = 0 THEN 0 ELSE ((c.profit - p.profit) / p.profit) * 100 END as profit_growth,
        CASE WHEN p.margin IS NULL OR p.margin = 0 THEN 0 ELSE ((c.margin - p.margin) / p.margin) * 100 END as margin_growth,
        CASE WHEN p.qty IS NULL OR p.qty = 0 THEN 0 ELSE ((c.qty - p.qty) / p.qty) * 100 END as qty_growth
    FROM curr c
    LEFT JOIN prev p ON c.name = p.name
    WHERE c.name IS NOT NULL
    ORDER BY c.revenue DESC NULLS LAST
    LIMIT 5000
    """
    
    query_res = cursor.execute(query).df()
    query_res = query_res.where(pandas.notnull(query_res), None)
    result_data = query_res.to_dict(orient='records')
    set_cached_data(cache_key, result_data)
    return result_data

def get_detail_table(dimension='Category', selected_group=None, top_n=10, filters=None, table_name='sales'):
    cache_key = f"detail_{table_name}_{dimension}_{selected_group}_{top_n}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    # In detail table, we filter based on 'Product name' for statuses
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND", dimension='Product name')
    mode = filters.get('dateMode', 'all') if filters else 'all'
    
    group_filter = ""
    if selected_group:
        clean_group = str(selected_group).replace("'", "''")
        group_filter = f" AND \"{dimension}\" = '{clean_group}'"
        
    if mode == 'all':
        curr_filter = f"WHERE 1=1 {extra_filters} {group_filter}"
        prev_filter = "WHERE 1=0"
    else:
        curr_s, curr_e = get_current_window(filters, table_name=table_name)
        prev_s, prev_e = get_prev_window(filters, table_name=table_name)
        curr_filter = f"WHERE CAST(date AS DATE) >= '{curr_s}' AND CAST(date AS DATE) <= '{curr_e}' {extra_filters} {group_filter}"
        if prev_s and prev_e:
            prev_filter = f"WHERE CAST(date AS DATE) >= '{prev_s}' AND CAST(date AS DATE) <= '{prev_e}' {extra_filters} {group_filter}"
        else:
            prev_filter = "WHERE 1=0"
    
    # Determine columns based on table
    if table_name == 'purchase':
        revenue_col = "Amount_USD"
        profit_col = "0"
        margin_col = "0"
        qty_col = "Qty"
    else:
        revenue_col = "Amount_USD"
        profit_col = "Profit_USD"
        margin_col = "\"Margin_%\""
        qty_col = "Qty"

    query = f"""
    WITH curr AS (
        SELECT "Product name" as name, SUM({revenue_col}) as revenue, SUM({profit_col}) as profit, AVG({margin_col}) as margin, SUM({qty_col}) as qty 
        FROM {table_name} {curr_filter} GROUP BY 1
    ),
    prev AS (
        SELECT "Product name" as name, SUM({revenue_col}) as revenue, SUM({profit_col}) as profit, AVG({margin_col}) as margin, SUM({qty_col}) as qty 
        FROM {table_name} {prev_filter} GROUP BY 1
    )
    SELECT 
        c.name, 
        c.revenue, c.profit, c.margin, c.qty,
        CASE WHEN p.revenue IS NULL OR p.revenue = 0 THEN 0 ELSE ((c.revenue - p.revenue) / p.revenue) * 100 END as revenue_growth,
        CASE WHEN p.profit IS NULL OR p.profit = 0 THEN 0 ELSE ((c.profit - p.profit) / p.profit) * 100 END as profit_growth,
        CASE WHEN p.margin IS NULL OR p.margin = 0 THEN 0 ELSE ((c.margin - p.margin) / p.margin) * 100 END as margin_growth,
        CASE WHEN p.qty IS NULL OR p.qty = 0 THEN 0 ELSE ((c.qty - p.qty) / p.qty) * 100 END as qty_growth
    FROM curr c
    LEFT JOIN prev p ON c.name = p.name
    WHERE c.name IS NOT NULL
    ORDER BY c.revenue DESC NULLS LAST
    LIMIT {top_n}
    """
    
    query_res = cursor.execute(query).df()
    query_res = query_res.where(pandas.notnull(query_res), None)
    result_data = query_res.to_dict(orient='records')
    set_cached_data(cache_key, result_data)
    return result_data
def get_period_ai_payload(start_a: str, end_a: str, start_b: str, end_b: str, table_name='sales'):
    """
    Implements the core mathematical logic for AI Summary.
    Compares Period B (target) vs Period A (baseline).
    """
    conn = get_connection()
    
    # Validation
    if not (validate_date(start_a) and validate_date(end_a) and validate_date(start_b) and validate_date(end_b)):
        return {"error": "Invalid date format"}

    # 1. Base query for metrics per counterparty and product
    metrics_query = f"""
        WITH period_data AS (
            SELECT 
                counterparty,
                "Product name" as product,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as rev_a,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as rev_b
            FROM {table_name}
            WHERE (CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}')
               OR (CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}')
            GROUP BY 1, 2
        ),
        client_deltas AS (
            SELECT 
                counterparty,
                SUM(rev_a) as client_rev_a,
                SUM(rev_b) as client_rev_b,
                SUM(rev_b) - SUM(rev_a) as client_delta
            FROM period_data
            GROUP BY 1
        )
        SELECT * FROM client_deltas
    """
    
    try:
        # Load client deltas into pandas for classification and driver selection
        df_clients = conn.execute(metrics_query).df()
        
        # Global Metrics
        total_rev_a = df_clients['client_rev_a'].sum()
        total_rev_b = df_clients['client_rev_b'].sum()
        net_delta = total_rev_b - total_rev_a
        
        gross_positive = df_clients[df_clients['client_delta'] > 0]['client_delta'].sum()
        gross_negative = df_clients[df_clients['client_delta'] < 0]['client_delta'].sum()
        
        # Threshold X (3% of Period A revenue, minimum 100 to avoid noise)
        X = max(total_rev_a * 0.03, 100)
        
        # 2. Scenario Trigger
        scenario = "UNKNOWN"
        if abs(net_delta) < X:
            if gross_positive > X or abs(gross_negative) > X:
                scenario = "HIDDEN_ROTATION"
            else:
                scenario = "FLAT_SYSTEMIC"
        elif net_delta <= -X:
            scenario = "SIGNIFICANT_DROP"
        elif net_delta >= X:
            scenario = "SIGNIFICANT_GROWTH"
            
        # 3. Top Drivers (Filtered by SIGNIFICANCE)
        pos_threshold = gross_positive * 0.15
        neg_threshold = abs(gross_negative) * 0.15
        
        top_gainers_list = df_clients[df_clients['client_delta'] >= pos_threshold].sort_values('client_delta', ascending=False)
        top_decliners_list = df_clients[df_clients['client_delta'] <= -neg_threshold].sort_values('client_delta', ascending=True)
        
        # Helper to get significant products for a client (> 25% of client delta) + Summary for others
        def get_detailed_products(client_name, client_delta):
            p_query = f"""
                SELECT 
                    "Product name" as product,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_rev_a,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as p_rev_b,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) -
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_delta
                FROM {table_name}
                WHERE counterparty = '{client_name.replace("'", "''")}'
                GROUP BY 1
                HAVING p_delta != 0
                ORDER BY ABS(p_delta) DESC
            """
            df_p = conn.execute(p_query).df()
            if df_p.empty: return []

            # Filter significant (> 25%)
            threshold = abs(client_delta) * 0.25
            sig_mask = df_p['p_delta'].abs() >= threshold
            df_sig = df_p[sig_mask].head(3)
            
            res = [{
                "name": r['product'], 
                "rev_a": round(r['p_rev_a'], 2),
                "rev_b": round(r['p_rev_b'], 2),
                "delta": round(r['p_delta'], 2)
            } for _, r in df_sig.iterrows()]
            
            # If others exist and account for significant part (> 5% of client delta)
            df_others = df_p[~df_p.index.isin(df_sig.index)]
            others_delta = df_others['p_delta'].sum()
            
            if not df_others.empty and abs(others_delta) >= abs(client_delta) * 0.05:
                res.append({
                    "name": f"Other {len(df_others)} products (avg movement)",
                    "rev_a": round(df_others['p_rev_a'].sum(), 2),
                    "rev_b": round(df_others['p_rev_b'].sum(), 2),
                    "delta": round(others_delta, 2),
                    "is_summary": True
                })
            return res

        top_gainers = []
        for _, row in top_gainers_list.iterrows():
            top_gainers.append({
                "client": row['counterparty'],
                "rev_a": round(row['client_rev_a'], 2),
                "rev_b": round(row['client_rev_b'], 2),
                "delta": round(row['client_delta'], 2),
                "products": get_detailed_products(row['counterparty'], row['client_delta'])
            })
            
        top_decliners = []
        for _, row in top_decliners_list.iterrows():
            top_decliners.append({
                "client": row['counterparty'],
                "rev_a": round(row['client_rev_a'], 2),
                "rev_b": round(row['client_rev_b'], 2),
                "delta": round(row['client_delta'], 2),
                "products": get_detailed_products(row['counterparty'], row['client_delta'])
            })
            
        # 4. Global Product Health (Significant movers)
        gp_threshold = (gross_positive if net_delta > 0 else abs(gross_negative)) * 0.15
        global_products_query = f"""
            SELECT 
                "Product name" as product,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as rev_a,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as rev_b,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) - 
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as delta
            FROM {table_name}
            WHERE CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}'
               OR CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}'
            GROUP BY 1
            HAVING ABS(delta) >= {gp_threshold}
            ORDER BY ABS(delta) DESC
        """
        df_gp = conn.execute(global_products_query).df()
        global_product_health = {
            "top_gainers": df_gp[df_gp['delta'] > 0].sort_values('delta', ascending=False).to_dict(orient='records'),
            "top_decliners": df_gp[df_gp['delta'] < 0].sort_values('delta', ascending=True).to_dict(orient='records')
        }

        # 5. New Business & Churn (In-Out analysis)
        # New Clients
        new_clients = df_clients[(df_clients['client_rev_a'] == 0) & (df_clients['client_rev_b'] > 0)]
        new_clients_list = [
            {"name": row['counterparty'], "rev_a": 0, "rev_b": round(row['client_rev_b'], 2)} 
            for _, row in new_clients.sort_values('client_rev_b', ascending=False).head(10).iterrows()
        ]
        
        # Churned Clients
        churned_clients = df_clients[(df_clients['client_rev_a'] > 0) & (df_clients['client_rev_b'] == 0)]
        churned_clients_list = [
            {"name": row['counterparty'], "rev_a": round(row['client_rev_a'], 2), "rev_b": 0} 
            for _, row in churned_clients.sort_values('client_rev_a', ascending=False).head(10).iterrows()
        ]

        # New Products
        new_products_query = f"""
            SELECT 
                "Product name" as product,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_rev_a,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as p_rev_b
            FROM {table_name}
            GROUP BY 1
            HAVING p_rev_a = 0 AND p_rev_b > 0
            ORDER BY p_rev_b DESC
            LIMIT 10
        """
        new_products_res = conn.execute(new_products_query).fetchall()
        new_products_list = [
            {"name": r[0], "rev_a": 0, "rev_b": round(r[2], 2)} 
            for r in new_products_res
        ]
        
        # Churned Products
        churned_products_query = f"""
            SELECT 
                "Product name" as product,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_rev_a,
                SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as p_rev_b
            FROM {table_name}
            GROUP BY 1
            HAVING p_rev_a > 0 AND p_rev_b = 0
            ORDER BY p_rev_a DESC
            LIMIT 10
        """
        churned_products_res = conn.execute(churned_products_query).fetchall()
        churned_products_list = [
            {"name": r[0], "rev_a": round(r[1], 2), "rev_b": 0} 
            for r in churned_products_res
        ]

        # 6. Mini App Specific Trends (Last 7 Days & Last 7 Weeks)
        # We use end_b as the "reference" today for the report
        try:
            ref_date = pandas.to_datetime(end_b)
            
            # 7 Days Trend (Yesterday + 6 days before)
            seven_days_start = (ref_date - pandas.Timedelta(days=6)).strftime('%Y-%m-%d')
            daily_query = f"""
                SELECT CAST(date AS DATE) as date, SUM(Amount_USD) as revenue
                FROM {table_name}
                WHERE CAST(date AS DATE) BETWEEN '{seven_days_start}' AND '{end_b}'
                GROUP BY 1 ORDER BY 1 ASC
            """
            df_daily = conn.execute(daily_query).df()
            if not df_daily.empty:
                df_daily['date'] = pandas.to_datetime(df_daily['date']).dt.strftime('%Y-%m-%d')
                daily_trends = df_daily.to_dict(orient='records')
            else:
                daily_trends = []

            # 7 Weeks Trend (Current week + 6 weeks before)
            # Align to Monday
            seven_weeks_start = (ref_date - pandas.Timedelta(days=ref_date.weekday()) - pandas.Timedelta(weeks=6)).strftime('%Y-%m-%d')
            weekly_query = f"""
                SELECT date_trunc('week', CAST(date AS DATE)) as week_start, SUM(Amount_USD) as revenue
                FROM {table_name}
                WHERE CAST(date AS DATE) BETWEEN '{seven_weeks_start}' AND '{end_b}'
                GROUP BY 1 ORDER BY 1 ASC
            """
            df_weekly = conn.execute(weekly_query).df()
            if not df_weekly.empty:
                df_weekly['week_start'] = pandas.to_datetime(df_weekly['week_start']).dt.strftime('%Y-%m-%d')
                weekly_trends = df_weekly.to_dict(orient='records')
            else:
                weekly_trends = []
        except Exception as trend_err:
            logger.error(f"Error calculating mini-app trends: {trend_err}")
            daily_trends = []
            weekly_trends = []

        # 7. Other Clients Aggregation (Remaining Business - Split by G/D)
        top_client_names = [g['client'] for g in top_gainers] + [d['client'] for d in top_decliners]
        df_all_others = df_clients[~df_clients['counterparty'].isin(top_client_names)]
        
        other_clients_payload = {"gainers": None, "decliners": None}
        
        for group_key, mask in [("gainers", df_all_others['client_delta'] > 0), ("decliners", df_all_others['client_delta'] < 0)]:
            df_grp = df_all_others[mask]
            if df_grp.empty: continue
            
            grp_rev_a = df_grp['client_rev_a'].sum()
            grp_rev_b = df_grp['client_rev_b'].sum()
            grp_delta = grp_rev_b - grp_rev_a
            
            # Find top 3 products for this group (Gainers show growth, Decliners show decline)
            dir_filter = "p_delta > 0" if group_key == "gainers" else "p_delta < 0"
            dir_order = "p_delta DESC" if group_key == "gainers" else "p_delta ASC"
            
            grp_placeholders = ",".join(["?"] * len(df_grp))
            grp_products_query = f"""
                SELECT 
                    "Product name" as product,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_rev_a,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as p_rev_b,
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) -
                    SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as p_delta
                FROM {table_name}
                WHERE counterparty IN ({grp_placeholders})
                GROUP BY 1
                HAVING {dir_filter}
                ORDER BY {dir_order}
                LIMIT 3
            """
            try:
                df_grp_p = conn.execute(grp_products_query, df_grp['counterparty'].tolist()).df()
                grp_products = [{
                    "name": r['product'],
                    "rev_a": round(r['p_rev_a'], 2),
                    "rev_b": round(r['p_rev_b'], 2),
                    "delta": round(r['p_delta'], 2)
                } for _, r in df_grp_p.iterrows()]
                
                # Summary for remaining products in this group
                p_sum_query = f"""
                    SELECT COUNT(DISTINCT "Item name"), SUM(Amount_USD)
                    FROM {table_name}
                    WHERE counterparty IN ({grp_placeholders})
                """
                # More robust: total products in group minus the top 3
                total_grp_products_query = f"""
                    SELECT "Product name", 
                           SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_a}' AND '{end_a}' THEN Amount_USD ELSE 0 END) as r_a,
                           SUM(CASE WHEN CAST(date AS DATE) BETWEEN '{start_b}' AND '{end_b}' THEN Amount_USD ELSE 0 END) as r_b
                    FROM {table_name}
                    WHERE counterparty IN ({grp_placeholders})
                    GROUP BY 1
                """
                df_all_p = conn.execute(total_grp_products_query, df_grp['counterparty'].tolist()).df()
                top_p_names = [p['name'] for p in grp_products]
                df_rem_p = df_all_p[~df_all_p['Product name'].isin(top_p_names)]
                
                if not df_rem_p.empty:
                    rem_rev_a = df_rem_p['r_a'].sum()
                    rem_rev_b = df_rem_p['r_b'].sum()
                    rem_delta = rem_rev_b - rem_rev_a
                    if abs(rem_delta) > 0.01:
                        grp_products.append({
                            "name": f"Other {len(df_rem_p)} products (avg movement)",
                            "rev_a": round(rem_rev_a, 2),
                            "rev_b": round(rem_rev_b, 2),
                            "delta": round(rem_delta, 2),
                            "is_summary": True
                        })
            except Exception as grp_p_err:
                logger.error(f"Error in group products: {grp_p_err}")
                grp_products = []

            other_clients_payload[group_key] = {
                "client": f"Other {len(df_grp)} Drivers",
                "client_count": len(df_grp),
                "rev_a": round(grp_rev_a, 2),
                "rev_b": round(grp_rev_b, 2),
                "delta": round(grp_delta, 2),
                "products": grp_products
            }

        # 6. TOP 5 RANKINGS BY DIMENSION
        def get_top_5(dim):
            try:
                # Use start_b and end_b which are parameters of the outer function
                q = f'SELECT "{dim}" as name, SUM(Amount_USD) as rev FROM {table_name} WHERE CAST(date AS DATE) BETWEEN \'{start_b}\' AND \'{end_b}\' GROUP BY 1 ORDER BY 2 DESC LIMIT 5'
                rows = conn.execute(q).fetchall()
                return [{"name": r[0], "rev": round(r[1], 2)} for r in rows]
            except Exception as t5_err:
                logger.error(f"Error calculating Top 5 for {dim}: {t5_err}")
                return []

        top_5_rankings = {
            "products": get_top_5("Product name"),
            "categories": get_top_5("Category"),
            "clients": get_top_5("counterparty")
        }

        # Final JSON Payload
        payload = {
            "daily_trends": daily_trends,
            "weekly_trends": weekly_trends,
            "period_info": {
                "period_a": {"start": start_a, "end": end_a},
                "period_b": {"start": start_b, "end": end_b}
            },
            "global_metrics": {
                "rev_a": round(total_rev_a, 2),
                "rev_b": round(total_rev_b, 2),
                "net_delta": round(net_delta, 2),
                "gross_positive": round(gross_positive, 2),
                "gross_negative": round(gross_negative, 2)
            },
            "drivers": {
                "top_gainers": top_gainers,
                "top_decliners": top_decliners,
                "other_clients": other_clients_payload
            },
            "global_product_health": global_product_health,
            "top_5_rankings": top_5_rankings,
            "new_business": {
                "new_clients": new_clients_list,
                "new_products_sold": new_products_list
            },
            "churn": {
                "churned_clients": churned_clients_list,
                "churned_products": churned_products_list
            }
        }
        
        return payload

    except Exception as e:
        logger.error(f"Error calculating AI payload: {e}")
        return {"error": str(e)}
