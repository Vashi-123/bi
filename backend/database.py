import duckdb
import os
from datetime import datetime
import pandas
import time
from threading import Lock

# Path to the partitioned parquet dataset
# Use environment variable DATA_PATH if available, else default to relative path
DATA_PATH = os.getenv("DATA_PATH", "./project_data/processed/final_df/**/*.parquet")

# Global connection and cache
_CONN = None
_CACHE = {}
_CACHE_LOCK = Lock()
CACHE_TTL = 300  # 5 minutes

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
                    CREATE OR REPLACE VIEW sales AS 
                    SELECT * FROM read_parquet('{DATA_PATH}') 
                    WHERE CAST(date AS DATE) >= CAST('{max_date}' AS DATE) - INTERVAL '6 month'
                """
                _CONN.execute(query)
                print(f"INFO: Database initialized. Window: Last 6 months from {max_date}")
            else:
                _CONN.execute(f"CREATE OR REPLACE VIEW sales AS SELECT * FROM read_parquet('{DATA_PATH}')")
        except Exception as e:
            print(f"WARNING: Could not pre-filter data: {e}")
            _CONN.execute(f"CREATE OR REPLACE VIEW sales AS SELECT * FROM read_parquet('{DATA_PATH}')")
    return _CONN

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

def get_current_window(filters=None):
    """Returns the (start, end) dates for the current data window, respecting filters."""
    cursor = get_cursor()
    # Always get the true max date from DB
    max_d = cursor.execute("SELECT MAX(date) FROM sales").fetchone()[0]
    if not max_d: return None, None
    
    # If custom filter is provided, try to extract its range
    if filters:
        mode = filters.get('dateMode', 'all')
        start = filters.get('startDate')
        end = filters.get('endDate')
        rel_val = filters.get('relativeValue')
        rel_unit = filters.get('relativeUnit', 'day')
        
        if mode == 'between' and start and end:
            return start, end
        elif mode == 'before' and end:
            # For 'before', we go back from the specific end date (arbitrary 1 year or just some start)
            return cursor.execute(f"SELECT MIN(date) FROM sales WHERE CAST(date AS DATE) <= '{end}'").fetchone()[0], end
        elif mode == 'after' and start:
            return start, max_d
        elif mode == 'relative' and rel_val:
            s = cursor.execute(f"SELECT CAST('{max_d}' AS DATE) - INTERVAL '{rel_val} {rel_unit}'").fetchone()[0]
            return str(s), str(max_d)

    # Standard fallback: Last 6 months from MAX date
    start_d = cursor.execute(f"SELECT CAST('{max_d}' AS DATE) - INTERVAL '6 month'").fetchone()[0]
    return str(start_d), str(max_d)

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
    
    # Get data max date for relative filtering
    _, end_date = get_current_window()
    
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
        print(f"DEBUG: Date Filter Mode: {mode}, Clause: '{clause}'")
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
    
    query = f"SELECT DISTINCT \"{dimension}\" FROM sales {where_clause} ORDER BY \"{dimension}\" ASC LIMIT 100"
    res = cursor.execute(query).fetchall()
    out = [row[0] for row in res]
    set_cached_data(cache_key, out)
    return out

def get_kpi_data(filters=None):
    if not filters: filters = {}
    print(f"KPI REQUEST FILTERS: {filters}")
    cache_key = f"kpi_data_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    _, end_date = get_current_window(filters) # Use actual window for comparison
    if not end_date:
        return {"revenue": {"value":0,"prev":0,"growth":0}, "profit": {"value":0,"prev":0,"growth":0}, "margin": {"value":0,"prev":0,"growth":0}, "qty": {"value":0,"prev":0,"growth":0}}
    
    # Check for custom date filter
    date_mode = filters.get('dateMode', 'all')
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause({k:v for k,v in filters.items() if k not in ['dateMode','startDate','endDate','relativeValue','relativeUnit']}, prefix="AND")

    if date_mode != 'all' and date_clause:
        # CUSTOM DATE RANGE: No comparison
        query = f"""
            SELECT SUM(Amount_USD), SUM(Profit_USD), AVG("Margin_%"), SUM(Qty)
            FROM sales WHERE 1=1 {date_clause} {extra_filters}
        """
        res = cursor.execute(query).fetchone()
        return {
            "revenue": {"value": res[0] or 0, "prev": None, "growth": 0},
            "profit": {"value": res[1] or 0, "prev": None, "growth": 0},
            "margin": {"value": res[2] or 0, "prev": None, "growth": 0},
            "qty": {"value": res[3] or 0, "prev": None, "growth": 0},
            "meta": {"current_period": "Custom Selection", "prev_period": None}
        }

    # 3-month comparison logic (Standard)
    current_date_filter = f"CAST(date AS DATE) > CAST('{end_date}' AS DATE) - INTERVAL '3 month' AND CAST(date AS DATE) <= '{end_date}'"
    previous_date_filter = f"CAST(date AS DATE) >= CAST('{end_date}' AS DATE) - INTERVAL '6 month' AND CAST(date AS DATE) <= CAST('{end_date}' AS DATE) - INTERVAL '3 month'"

    query = f"""
    WITH current_kpi AS (
        SELECT SUM(Amount_USD) as rev, SUM(Profit_USD) as prof, AVG("Margin_%") as marg, SUM(Qty) as qty
        FROM sales WHERE {current_date_filter} {extra_filters}
    ),
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
    print(f"TRENDS REQUEST FILTERS: {filters}")
    cache_key = f"trends_{metric}_{dimension}_{top_n}_{interval}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    start_date, end_date = get_current_window(filters)
    if not start_date: return []

    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    col = metric_map.get(metric, metric)
    
    date_clause = build_date_filter_clause(filters)
    extra_filters = build_filter_clause({k:v for k,v in filters.items() if k not in ['dateMode','startDate','endDate','relativeValue','relativeUnit']}, prefix="AND")
    
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
        print(f"ERROR in get_trends SQL: {e}\nQuery: {query}")
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
    extra_filters = build_filter_clause({k:v for k,v in filters.items() if k not in ['dateMode','startDate','endDate','relativeValue','relativeUnit']}, prefix="AND")
    
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
    extra_filters = build_filter_clause({k:v for k,v in filters.items() if k not in ['dateMode','startDate','endDate','relativeValue','relativeUnit']}, prefix="AND")
    
    if date_clause:
        filter_clause = f"WHERE 1=1 {date_clause} {extra_filters}"
    else:
        s, e = get_current_window(filters)
        filter_clause = f"WHERE CAST(date AS DATE) >= '{s}' AND CAST(date AS DATE) <= '{e}' {extra_filters}"
    
    query = f"SELECT \"{dimension}\" as name, SUM(Amount_USD) as revenue, SUM(Profit_USD) as profit, AVG(\"Margin_%\") as margin, SUM(Qty) as qty FROM sales {filter_clause} GROUP BY 1 ORDER BY revenue DESC"
    
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
    extra_filters = build_filter_clause({k:v for k,v in filters.items() if k not in ['dateMode','startDate','endDate','relativeValue','relativeUnit']}, prefix="AND")
    
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
