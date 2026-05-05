import os
import sys
import datetime
import logging
from dotenv import load_dotenv

# Ensure we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from the project root
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, ".env"))

import database
try:
    from supabase_client import SupabaseManager
except ImportError:
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'miniapps', 'backend'))
    from supabase_client import SupabaseManager

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("history-populator")

def populate_30_days():
    """
    Iterates through the last 30 days and generates/uploads analytical reports.
    """
    try:
        # 1. Initialize Supabase
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            logger.error("Missing Supabase credentials in .env")
            return

        sb_manager = SupabaseManager(url, key)
        today = datetime.date.today()

        # 2. Iterate through last 30 days
        for i in range(1, 31):
            target_date = today - datetime.timedelta(days=i)
            prev_date = target_date - datetime.timedelta(days=1)
            
            date_str_b = target_date.strftime('%Y-%m-%d')
            date_str_a = prev_date.strftime('%Y-%m-%d')
            
            report_id = f"daily_analytics_{date_str_b}"
            
            logger.info(f"[{i}/30] Processing report for {date_str_b} (vs {date_str_a})...")

            try:
                # Calculate Payload
                parquet_table = f"read_parquet('{database.DATA_PATH}')"
                payload = database.get_period_ai_payload(date_str_a, date_str_a, date_str_b, date_str_b, table_name=parquet_table)
                
                if "error" in payload:
                    logger.error(f"  ❌ Failed to calculate for {date_str_b}: {payload['error']}")
                    continue

                # Upsert to Supabase
                success = sb_manager.upsert_analytical_report(report_id, payload)
                if success:
                    logger.info(f"  ✅ Saved as {report_id}")
                else:
                    logger.error(f"  ❌ Failed to save {report_id}")
            
            except Exception as e:
                logger.error(f"  ❌ Error processing {date_str_b}: {str(e)}")

        logger.info("🎉 Historical data population completed.")

    except Exception as e:
        logger.error(f"Population script failed: {str(e)}")
    finally:
        database.close_connection()

if __name__ == "__main__":
    print("🚀 Starting 30-day historical data population...")
    print("This may take a few minutes as it calculates each day sequentially.")
    populate_30_days()
