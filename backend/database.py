import duckdb
import os
import json
import re
from datetime import datetime
import pandas
import time
import logging
from threading import Lock

logger = logging.getLogger(__name__)

# Input validation
DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')
DATE_FILTER_KEYS = {'dateMode', 'startDate', 'endDate', 'relativeValue', 'relativeUnit'}
ALLOWED_COLUMNS = {'type', 'Category', 'Currency', 'counterparty', 'Groupclient', 'Product country', 'CountryGroup', 'Item name', 'Product name'}

def validate_date(date_str: str) -> bool:
    """Returns True if date_str matches YYYY-MM-DD format."""
    return bool(date_str and DATE_PATTERN.match(date_str))

def extract_column_filters(filters: dict) -> dict:
    """Separates column filters from date filter parameters."""
    return {k: v for k, v in filters.items() if k not in DATE_FILTER_KEYS}

# Path to the partitioned parquet dataset
# Use environment variable DATA_PATH if available, else default to relative path
DATA_PATH = os.getenv("DATA_PATH", "./project_data/processed/final_df/**/*.parquet")

# Global connection and cache
_CONN = None
_CACHE = {}
_CACHE_LOCK = Lock()
CACHE_TTL = 300  # 5 minutes
GROUPS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "groups.json")

def get_connection():
    global _CONN
    if _CONN is None:
        # Initialize one global connection
        _CONN = duckdb.connect(database=':memory:')
        try:
            # Efficiently find max date to set the window for the entire dashboard
            max_row = _CONN.execute(f"SELECT MAX(date) FROM read_parquet('{DATA_PATH}')").fetchone()
            if max_row and max_row[0]:
                max_date = max_row[0]
                # DEFAULT: 6 months limit as requested
                query = f"""
                    CREATE OR REPLACE VIEW sales_raw AS 
                    SELECT * FROM read_parquet('{DATA_PATH}') 
                    WHERE CAST(date AS DATE) >= CAST('{max_date}' AS DATE) - INTERVAL '6 month'
                """
                _CONN.execute(query)
                logger.info(f"Database initialized. Window: Last 6 months from {max_date}")
            else:
                _CONN.execute(f"CREATE OR REPLACE VIEW sales_raw AS SELECT * FROM read_parquet('{DATA_PATH}')")
            
            # Load custom groups if they exist
            refresh_groups_table()

        except Exception as e:
            logger.warning(f"Could not pre-filter data: {e}")
            _CONN.execute(f"CREATE OR REPLACE VIEW sales_raw AS SELECT * FROM read_parquet('{DATA_PATH}')")
            _CONN.execute("CREATE TABLE IF NOT EXISTS custom_groups (counterparty VARCHAR, group_name VARCHAR)")
            _CONN.execute("CREATE OR REPLACE VIEW sales AS SELECT * FROM sales_raw")
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
    
    # 3. Create Enriched View dynamically to avoid errors if columns don't exist
    cols_res = conn.execute("DESCRIBE sales_raw").fetchall()
    existing_cols = [row[0] for row in cols_res]
    
    exclude_cols = []
    if 'Groupclient' in existing_cols:
        exclude_cols.append('Groupclient')
    if 'CountryGroup' in existing_cols:
        exclude_cols.append('CountryGroup')
        
    exclude_clause = f"EXCLUDE ({', '.join(exclude_cols)})" if exclude_cols else ""
    
    gc_fallback = "s.Groupclient" if "Groupclient" in existing_cols else "NULL"
    cg_fallback = "s.CountryGroup" if "CountryGroup" in existing_cols else "NULL"
    
    conn.execute(f"""
        CREATE OR REPLACE VIEW sales AS 
        SELECT 
            s.* {exclude_clause},
            COALESCE(g.group_name, {gc_fallback}, s.counterparty) as Groupclient,
            COALESCE(cg.group_name, {cg_fallback}, 'Other') as CountryGroup
        FROM sales_raw s
        LEFT JOIN custom_groups g ON LOWER(TRIM(s.counterparty)) = g.counterparty
        LEFT JOIN custom_country_groups cg ON UPPER(TRIM(s."Product country")) = cg.country_code
    """)

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

def get_unique_counterparties():
    """Returns all unique counterparties from the raw dataset."""
    cursor = get_cursor()
    res = cursor.execute("SELECT DISTINCT counterparty FROM sales_raw WHERE counterparty IS NOT NULL ORDER BY 1").fetchall()
    return [r[0] for r in res]

def get_unique_countries():
    """Returns all unique country codes from the raw dataset."""
    cursor = get_cursor()
    res = cursor.execute("SELECT DISTINCT \"Product country\" FROM sales_raw WHERE \"Product country\" IS NOT NULL ORDER BY 1").fetchall()
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

def get_current_window(filters):
    cursor = get_cursor()
    max_res = cursor.execute("SELECT MAX(date) FROM sales").fetchone()
    if not max_res or not max_res[0]: return None, None
    max_d = max_res[0]

    mode = filters.get('dateMode', 'all')
    if mode == 'all':
        min_d = cursor.execute("SELECT MIN(date) FROM sales").fetchone()[0]
        return min_d.strftime('%Y-%m-%d'), max_d.strftime('%Y-%m-%d')
    
    if mode == 'between':
        return filters.get('startDate'), filters.get('endDate')
    
    if mode == 'relative':
        val = int(filters.get('relativeValue', 3))
        unit = filters.get('relativeUnit', 'month')
        
        if unit == 'month': start_dt = max_d - pandas.Timedelta(days=30*val)
        elif unit == 'week': start_dt = max_d - pandas.Timedelta(days=7*val)
        else: start_dt = max_d - pandas.Timedelta(days=val)
        
        return start_dt.strftime('%Y-%m-%d'), max_d.strftime('%Y-%m-%d')
    
    return filters.get('startDate'), filters.get('endDate')

def get_prev_window(filters):
    s, e = get_current_window(filters)
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

def get_kpi_data(filters=None):
    if not filters: filters = {}
    cursor = get_cursor()
    
    curr_s, curr_e = get_current_window(filters)
    prev_s, prev_e = get_prev_window(filters)
    
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    # Current Period Query
    curr_query = f"""
        SELECT SUM(Amount_USD), SUM(Profit_USD), AVG("Margin_%"), SUM(Qty)
        FROM sales WHERE CAST(date AS DATE) >= '{curr_s}' AND CAST(date AS DATE) <= '{curr_e}' {extra_filters}
    """
    c_res = cursor.execute(curr_query).fetchone()
    
    # Previous Period Query
    p_res = [0, 0, 0, 0]
    if prev_s and prev_e:
        # Check if we have data before curr_s
        global_min = cursor.execute("SELECT MIN(date) FROM sales").fetchone()[0]
        if pandas.to_datetime(prev_s) >= pandas.to_datetime(global_min):
            prev_query = f"""
                SELECT SUM(Amount_USD), SUM(Profit_USD), AVG("Margin_%"), SUM(Qty)
                FROM sales WHERE CAST(date AS DATE) >= '{prev_s}' AND CAST(date AS DATE) <= '{prev_e}' {extra_filters}
            """
            p_res = cursor.execute(prev_query).fetchone()
    
    def calc_growth(curr, prev):
        if not prev or prev == 0: return 0
        return ((curr - prev) / prev) * 100

    return {
        "revenue": {"value": c_res[0] or 0, "prev": p_res[0] or 0, "growth": calc_growth(c_res[0] or 0, p_res[0] or 0)},
        "profit": {"value": c_res[1] or 0, "prev": p_res[1] or 0, "growth": calc_growth(c_res[1] or 0, p_res[1] or 0)},
        "margin": {"value": c_res[2] or 0, "prev": p_res[2] or 0, "growth": calc_growth(c_res[2] or 0, p_res[2] or 0)},
        "qty": {"value": c_res[3] or 0, "prev": p_res[3] or 0, "growth": calc_growth(c_res[3] or 0, p_res[3] or 0)},
        "meta": {
            "current_period": format_period_label(curr_s, curr_e),
            "prev_period": format_period_label(prev_s, prev_e) if p_res[0] else None
        }
    }

def build_filter_clause(filters, prefix="WHERE"):
    """Dynamically builds a WHERE clause based on the provided filters dictionary."""
    if not filters:
        return ""
    
    clauses = []
    for col, values in filters.items():
        if values and isinstance(values, list):
            val_str = ", ".join(["'" + str(v).replace("'", "''") + "'" for v in values])
            clauses.append(f"\"{col}\" IN ({val_str})")
        elif values and not isinstance(values, dict): # Avoid including date params as standard filters
             clauses.append(f"\"{col}\" = '" + str(values).replace("'", "''") + "'")
    
    if not clauses:
        return ""
    
    return f"{prefix} " + " AND ".join(clauses)

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
    elif mode == 'relative' and rel_val and end_date:
        clause = f"AND CAST(date AS DATE) >= CAST('{end_date}' AS DATE) - INTERVAL '{rel_val} {rel_unit}'"
    
    if mode != 'all':
        logger.debug(f"Date Filter Mode: {mode}, Clause: '{clause}'")
    return clause

def get_filter_options(dimension, search=None):
    """Returns a list of unique values for a given dimension column with optional search."""
    cache_key = f"filter_options_{dimension}_{search}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    where_clause = f"WHERE \"{dimension}\" IS NOT NULL"
    if search:
        clean_search = str(search).replace("'", "''")
        where_clause += f" AND \"{dimension}\" ILIKE '%{clean_search}%'"
    
    query = f"SELECT DISTINCT \"{dimension}\" FROM sales {where_clause} ORDER BY \"{dimension}\" ASC LIMIT 5000"
    try:
        res = cursor.execute(query).fetchall()
        out = [row[0] for row in res if row[0] is not None]
        set_cached_data(cache_key, out)
        return out
    except Exception as e:
        logger.error(f"Error getting filter options for {dimension}: {e}")
        return []

_OVERALL_DATE_RANGE = None

def get_overall_date_range():
    """Returns the absolute min and max dates in the dataset. Cached after first call."""
    global _OVERALL_DATE_RANGE
    if _OVERALL_DATE_RANGE is not None:
        return _OVERALL_DATE_RANGE
    cursor = get_cursor()
    res = cursor.execute("SELECT MIN(CAST(date AS DATE)), MAX(CAST(date AS DATE)) FROM sales").fetchone()
    _OVERALL_DATE_RANGE = {"min": str(res[0]) if res[0] else None, "max": str(res[1]) if res[1] else None}
    return _OVERALL_DATE_RANGE

    previous_kpi AS (
        SELECT SUM(Amount_USD) as rev, SUM(Profit_USD) as prof, AVG("Margin_%") as marg, SUM(Qty) as qty
        FROM sales WHERE {previous_date_filter} {extra_filters}
    )
    SELECT c.rev, c.prof, c.marg, c.qty, p.rev, p.prof, p.marg, p.qty
    FROM current_kpi c, previous_kpi p
    """
    res = cursor.execute(query).fetchone()
    
    # Get human-readable date labels
    date_info = cursor.execute(f"""
        SELECT 
            strftime(CAST('{end_date}' AS DATE) - INTERVAL '3 month', '%b %Y') || ' - ' || strftime(CAST('{end_date}' AS DATE), '%b %Y') as current_range,
            strftime(CAST('{end_date}' AS DATE) - INTERVAL '6 month', '%b %Y') || ' - ' || strftime(CAST('{end_date}' AS DATE) - INTERVAL '3 month', '%b %Y') as prev_range
    """).fetchone()

    def calc_growth(cur, prev):
        if not prev or prev == 0: return 0
        return ((cur - prev) / prev) * 100

    out = {
        "revenue": {"value": res[0] or 0, "prev": res[4] or 0, "growth": calc_growth(res[0], res[4])},
        "profit": {"value": res[1] or 0, "prev": res[5] or 0, "growth": calc_growth(res[1], res[5])},
        "margin": {"value": res[2] or 0, "prev": res[6] or 0, "growth": calc_growth(res[2], res[6])},
        "qty": {"value": res[3] or 0, "prev": res[7] or 0, "growth": calc_growth(res[3], res[7])},
        "meta": {
            "current_period": date_info[0] if date_info else "",
            "prev_period": date_info[1] if date_info else ""
        }
    }
    set_cached_data(cache_key, out)
    return out

def get_trends(metric='revenue', dimension='Category', top_n=5, interval='day', filters=None):
    if not filters: filters = {}
    logger.debug(f"Trends request filters: {filters}")
    cache_key = f"trends_{metric}_{dimension}_{top_n}_{interval}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    start_date, end_date = get_current_window(filters)
    if not start_date: return []

    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    col = metric_map.get(metric, metric)
    
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        # Fallback to current window window if no filter (already restricted by START/END above)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{start_date}' AND CAST(date AS DATE) <= '{end_date}' {extra_filters}"

    # 1. Find Top N categories
    top_n_query = f"SELECT \"{dimension}\" FROM sales {filter_clause} AND \"{dimension}\" IS NOT NULL GROUP BY 1 ORDER BY SUM({col}) DESC LIMIT {top_n}"
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

    dim_expr = f"CASE WHEN \"{dimension}\" IN ({', '.join([f"'{d}'" for d in top_dims])}) THEN \"{dimension}\" ELSE 'Other' END"
    
    query = f"""
    WITH calendar AS ({cal_gen}),
    dims AS (SELECT unnest([{', '.join([f"'{d}'" for d in top_dims + ['Other']])}]) as dim_val),
    full_grid AS (SELECT c.d, d.dim_val FROM calendar c, dims d),
    sales_agg AS (
        SELECT CAST({sales_d} AS DATE) as cal_d, {dim_expr} as dim_val, SUM({col}) as val
        FROM sales {filter_clause} GROUP BY 1, 2
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
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out

def get_distribution(metric='revenue', dimension='Category', top_n=5, filters=None):
    cache_key = f"dist_{metric}_{dimension}_{top_n}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    col = metric_map.get(metric, metric)
    
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        s, e = get_current_window(filters)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}' {extra_filters}"

    top_n_query = f"SELECT \"{dimension}\" FROM sales {filter_clause} AND \"{dimension}\" IS NOT NULL GROUP BY 1 ORDER BY SUM({col}) DESC LIMIT {top_n}"
    top_dims = [row[0] for row in cursor.execute(top_n_query).fetchall()]
    if not top_dims: return []

    dim_expr = f"CASE WHEN \"{dimension}\" IN ({', '.join([f"'{d}'" for d in top_dims])}) THEN \"{dimension}\" ELSE 'Other' END"
    query = f"SELECT {dim_expr} as dimension_value, SUM({col}) as value FROM sales {filter_clause} GROUP BY 1 ORDER BY value DESC"
    
    df = cursor.execute(query).df()
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out

def get_master_table(dimension='Category', filters=None):
    cache_key = f"master_{dimension}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        s, e = get_current_window(filters)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}' {extra_filters}"
    
    query = f"""SELECT "{dimension}" as name, SUM(Amount_USD) as revenue, SUM(Profit_USD) as profit, AVG("Margin_%") as margin, SUM(Qty) as qty 
                FROM sales {filter_clause} GROUP BY 1 ORDER BY revenue DESC
                LIMIT 5000"""
    
    df = cursor.execute(query).df()
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out

def get_detail_table(dimension='Category', selected_group=None, top_n=10, filters=None):
    cache_key = f"detail_{dimension}_{selected_group}_{top_n}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause(extract_column_filters(filters), prefix="AND")
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        s, e = get_current_window(filters)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}' {extra_filters}"
    
    if selected_group:
        clean_group = str(selected_group).replace("'", "''")
        filter_clause += f" AND \"{dimension}\" = '{clean_group}'"
    
    query = f"SELECT \"Item name\" as name, SUM(Amount_USD) as revenue, SUM(Profit_USD) as profit, AVG(\"Margin_%\") as margin, SUM(Qty) as qty FROM sales {filter_clause} GROUP BY 1 ORDER BY revenue DESC LIMIT {top_n}"
    df = cursor.execute(query).df()
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out
