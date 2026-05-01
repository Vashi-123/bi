import os
import glob
import logging
import pandas
try:
    from database import get_cursor
except ImportError:
    from .database import get_cursor

logger = logging.getLogger(__name__)

def get_inventory_turnover(filters=None):
    """
    Calculates Inventory Turnover (Ratio and Days) for all items.
    Uses data from the last 30 days.
    """
    cursor = get_cursor()
    
    # 1. Determine paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    STOCK_DATA_PATH = os.path.join(base_dir, "..", "onedrive_folder", "project_data", "df_stock", "date=*", "*.parquet")
    SALES_DATA_PATH = os.path.join(base_dir, "..", "onedrive_folder", "project_data", "df_only", "date=*", "*.parquet")

    # If paths don't exist, fallback to local/relative
    if not any(glob.glob(STOCK_DATA_PATH, recursive=True)):
        STOCK_DATA_PATH = "./project_data/df_stock/date=*/*.parquet"
    if not any(glob.glob(SALES_DATA_PATH, recursive=True)):
        SALES_DATA_PATH = "./project_data/df_only/date=*/*.parquet"

    # 2. Build Filter Clauses
    where_clause = ""
    if filters:
        # We need to map frontend filter names to parquet column names if they differ
        # In this dataset, Category, Product name, etc. are used.
        clauses = []
        for col, values in filters.items():
            if not values: continue
            if col in ['Category', 'Product name', 'Product country', 'counterparty']:
                if isinstance(values, list):
                    clean_vals = [str(v).replace("'", "''") for v in values]
                    clauses.append(f"\"{col}\" IN ({', '.join([f"'{v}'" for v in clean_vals])})")
                else:
                    clauses.append(f"\"{col}\" = '{str(values).replace("'", "''")}'")
        if clauses:
            where_clause = "AND " + " AND ".join(clauses)

    try:
        # We'll use DuckDB to join and aggregate directly from parquet files
        query = f"""
        WITH 
        latest_dates AS (
            SELECT DISTINCT CAST(date AS DATE) as d 
            FROM read_parquet('{STOCK_DATA_PATH}') 
            ORDER BY d DESC LIMIT 30
        ),
        stock_agg AS (
            SELECT 
                item_id, 
                ANY_VALUE(item_name) as item_name,
                ANY_VALUE(product_name) as product_name,
                AVG(quantity) as avg_stock,
                MAX_BY(quantity, date) as current_stock
            FROM read_parquet('{STOCK_DATA_PATH}')
            WHERE CAST(date AS DATE) IN (SELECT d FROM latest_dates)
            {where_clause}
            GROUP BY 1
        ),
        sales_agg AS (
            SELECT 
                item_id, 
                SUM(qty) as total_sales
            FROM read_parquet('{SALES_DATA_PATH}')
            WHERE status = 'SUCCESS' AND type = 'VOUCHER_SALE'
            AND CAST(created_at_ymd AS DATE) IN (SELECT d FROM latest_dates)
            {where_clause.replace('Product name', 'product_name')} 
            GROUP BY 1
        )
        SELECT 
            s.item_id,
            s.item_name,
            s.product_name,
            ROUND(s.avg_stock, 2) as avg_stock,
            ROUND(s.current_stock, 2) as current_stock,
            COALESCE(sa.total_sales, 0) as total_sales,
            ROUND(COALESCE(sa.total_sales, 0) / NULLIF(s.avg_stock, 0), 2) as turnover_ratio,
            ROUND(CASE 
                WHEN COALESCE(sa.total_sales, 0) = 0 THEN 999 
                ELSE (s.avg_stock / NULLIF(sa.total_sales, 0)) * 30 
            END, 1) as turnover_days
        FROM stock_agg s
        LEFT JOIN sales_agg sa ON s.item_id = sa.item_id
        ORDER BY sa.total_sales DESC
        LIMIT 1000
        """
        
        df = cursor.execute(query).df()
        df = df.fillna(0)
        df['turnover_days'] = df['turnover_days'].replace([float('inf'), float('-inf')], 999)
        
        return df.to_dict(orient='records')
        
    except Exception as e:
        logger.error(f"Error calculating inventory turnover: {e}")
        return {"error": str(e)}
