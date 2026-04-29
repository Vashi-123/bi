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
    # Try alternate path if needed for the backend/ folder
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'miniapps', 'backend'))
    from supabase_client import SupabaseManager

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cron-report")

def generate_daily_report():
    """
    Calculates the daily analytical report (Yesterday vs Day Before Yesterday)
    and pushes it to Supabase for Mini App access.
    """
    try:
        # 1. Initialize Supabase
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            logger.error("Missing Supabase credentials in .env")
            return

        sb_manager = SupabaseManager(url, key)

        # 2. Calculate Dates
        # Period B: Yesterday
        # Period A: Day Before Yesterday
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        day_before = today - datetime.timedelta(days=2)

        start_b = end_b = yesterday.strftime('%Y-%m-%d')
        start_a = end_a = day_before.strftime('%Y-%m-%d')

        logger.info(f"Generating report for {start_b} (B) vs {start_a} (A)")

        # 3. Calculate Payload using existing database logic
        payload = database.get_period_ai_payload(start_a, end_a, start_b, end_b)
        
        if "error" in payload:
            logger.error(f"Payload calculation failed: {payload['error']}")
            return

        # 4. Upsert to Supabase
        success = sb_manager.upsert_analytical_report("daily_analytics", payload)
        
        if success:
            logger.info("✅ Daily report successfully synced to Supabase.")
        else:
            logger.error("❌ Failed to sync report to Supabase.")

    except Exception as e:
        logger.error(f"Cron execution failed: {str(e)}")

if __name__ == "__main__":
    generate_daily_report()
