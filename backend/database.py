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
                # Filter at the view level to 6 months
                query = f"""
                    CREATE OR REPLACE VIEW sales AS 
                    SELECT * FROM read_parquet('{DATA_PATH}') 
                    WHERE date >= CAST('{max_date}' AS DATE) - INTERVAL '6 month'
                """
                _CONN.execute(query)
                print(f"INFO: Database initialized. Data filtered to last 6 months from {max_date}")
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

def get_current_window():
    """Returns the start and end dates for the 6-month default window based on max date in data."""
    cache_key = "current_window"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    max_row = cursor.execute("SELECT MAX(date) FROM sales").fetchone()
    if not max_row or not max_row[0]:
        return None, None
    
    max_date = max_row[0]
    res = cursor.execute(f"""
        SELECT 
            CAST('{max_date}' AS DATE) as end_date,
            CAST('{max_date}' AS DATE) - INTERVAL '6 month' as start_date
    """).fetchone()
    
    out = (res[1], res[0])
    set_cached_data(cache_key, out)
    return out

def build_filter_clause(filters, prefix="WHERE"):
    """Dynamically builds a WHERE clause based on the provided filters dictionary."""
    if not filters:
        return ""
    
    clauses = []
    for col, values in filters.items():
        if values and isinstance(values, list):
            val_str = ", ".join(["'" + str(v).replace("'", "''") + "'" for v in values])
            clauses.append(f"\"{col}\" IN ({val_str})")
        elif values:
             clauses.append(f"\"{col}\" = '" + str(values).replace("'", "''") + "'")
    
    if not clauses:
        return ""
    
    return f" {prefix} " + " AND ".join(clauses)

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
    cache_key = f"kpi_data_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    _, end_date = get_current_window() # We still need the max date (end_date)
    if not end_date:
        return {"revenue": {"value":0,"prev":0,"growth":0}, "profit": {"value":0,"prev":0,"growth":0}, "margin": {"value":0,"prev":0,"growth":0}, "qty": {"value":0,"prev":0,"growth":0}}
    
    # 3-month comparison logic
    current_date_filter = f"date > CAST('{end_date}' AS DATE) - INTERVAL '3 month' AND date <= '{end_date}'"
    previous_date_filter = f"date >= CAST('{end_date}' AS DATE) - INTERVAL '6 month' AND date <= CAST('{end_date}' AS DATE) - INTERVAL '3 month'"
    extra_filters = build_filter_clause(filters, prefix="AND")

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
    cache_key = f"trends_{metric}_{dimension}_{top_n}_{interval}_{hash(str(filters))}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    cursor = get_cursor()
    start_date, end_date = get_current_window()
    if not start_date: return []

    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    col = metric_map.get(metric, metric)
    filter_clause = f"WHERE date >= '{start_date}' AND date <= '{end_date}'" + build_filter_clause(filters, prefix="AND")

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
        sales_d = "date_trunc('month', date)"

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
    df = cursor.execute(query).df()
    
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
    start_date, end_date = get_current_window()
    if not start_date: return []

    metric_map = {'revenue': 'Amount_USD', 'profit': 'Profit_USD', 'qty': 'Qty', 'margin': '"Margin_%"'}
    col = metric_map.get(metric, metric)
    filter_clause = f"WHERE date >= '{start_date}' AND date <= '{end_date}'" + build_filter_clause(filters, prefix="AND")

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
    start_date, end_date = get_current_window()
    if not start_date or not end_date: return []

    filter_clause = f"WHERE date >= '{start_date}' AND date <= '{end_date}'" + build_filter_clause(filters, prefix="AND")
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
    start_date, end_date = get_current_window()
    if not start_date: return []

    filter_clause = f"WHERE date >= '{start_date}' AND date <= '{end_date}'" + build_filter_clause(filters, prefix="AND")
    if selected_group:
        clean_group = str(selected_group).replace("'", "''")
        filter_clause += f" AND \"{dimension}\" = '{clean_group}'"
    
    query = f"SELECT \"Item name\" as name, SUM(Amount_USD) as revenue, SUM(Profit_USD) as profit, AVG(\"Margin_%\") as margin, SUM(Qty) as qty FROM sales {filter_clause} GROUP BY 1 ORDER BY revenue DESC LIMIT {top_n}"
    df = cursor.execute(query).df()
    out = df.to_dict(orient='records')
    set_cached_data(cache_key, out)
    return out
