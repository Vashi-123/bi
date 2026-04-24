import duckdb
import os
import logging
import pandas as pd

# ==========================================
# CONFIGURATION
# ==========================================
# Adjust these paths if they differ on your server
DATA_PATH = "/home/usman/onedrive_folder/project_data/final_df/**/*.parquet"
OUTPUT_DIR = "/home/usman/onedrive_folder"
OUTPUT_FILE = "pubg_max_sales_by_counterparty.csv"
LOG_FILE = "pubg_export.log"

# ==========================================
# LOGGING SETUP
# ==========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def run_export():
    try:
        logger.info("--- Starting PUBG Max Sales Export ---")
        
        con = duckdb.connect(database=':memory:')
        
        # 1. Identify columns and date field
        logger.info(f"Reading schema from {DATA_PATH}...")
        try:
            # Get one row to check columns
            sample = con.execute(f"SELECT * FROM read_parquet('{DATA_PATH}') LIMIT 1").df()
            cols = sample.columns.tolist()
            logger.info(f"Columns found: {', '.join(cols)}")
        except Exception as e:
            logger.error(f"Could not read parquet files at {DATA_PATH}. Check if path is correct.")
            return

        # Determine which date column to use
        # Priority: created_ymd (as requested) -> date (as used in app)
        date_col = None
        for candidate in ['created_ymd', 'date', 'Date', 'Created_YMD']:
            if candidate in cols:
                date_col = candidate
                break
        
        if not date_col:
            logger.error("Could not find a date column (created_ymd or date) in the data.")
            return
        
        logger.info(f"Using '{date_col}' for time grouping.")

        # 2. Analytical Query
        # We aggregate by counterparty and month, then find the top month for each.
        query = f"""
        WITH monthly_sales AS (
            SELECT 
                "counterparty",
                strftime(CAST("{date_col}" AS DATE), '%Y-%m') as sales_month,
                SUM("Amount_USD") as total_amount_usd
            FROM read_parquet('{DATA_PATH}')
            WHERE "Product name" IN (
                'PUBG Mobile Gift Card', 
                'PUBG Mobile Top Up', 
                'PUBG Mobile Gift Card | CIS'
            )
            AND "Product name" != 'PUBG: BATTLEGROUNDS | GL'
            GROUP BY 1, 2
        ),
        ranked_months AS (
            SELECT 
                "counterparty",
                sales_month,
                total_amount_usd,
                ROW_NUMBER() OVER(PARTITION BY "counterparty" ORDER BY total_amount_usd DESC) as rank
            FROM monthly_sales
        )
        SELECT 
            "counterparty",
            sales_month as "Max Sales Month",
            ROUND(total_amount_usd, 2) as "Max Monthly Amount USD"
        FROM ranked_months
        WHERE rank = 1
        ORDER BY "Max Monthly Amount USD" DESC
        """
        
        logger.info("Executing analytical query (this may take a moment)...")
        df = con.execute(query).df()
        
        if df.empty:
            logger.warning("No data found matching the PUBG product filters.")
            return

        # 3. Save Output
        output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
        logger.info(f"Exporting {len(df)} rows to {output_path}...")
        
        if not os.path.exists(OUTPUT_DIR):
            logger.info(f"Creating directory {OUTPUT_DIR}")
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        logger.info("--- Export Completed Successfully ---")
        print(f"\nSuccess! File saved to: {output_path}")

    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)

if __name__ == "__main__":
    run_export()
