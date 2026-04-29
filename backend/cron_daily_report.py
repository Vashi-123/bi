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

import time

def run_scheduler(target_time="07:00"):
    logger.info(f"📅 Scheduler started. Target time: {target_time}")
    report_done_today = False
    
    while True:
        now = datetime.datetime.now()
        current_time = now.strftime("%H:%M")
        current_date = now.date()

        # Reset flag at midnight
        if current_time == "00:00":
            report_done_today = False

        if current_time == target_time and not report_done_today:
            logger.info("⏰ Target time reached. Starting daily report generation...")
            generate_daily_report()
            report_done_today = True
            logger.info(f"✅ Report for {current_date} completed. Waiting for tomorrow...")
            # Sleep for 61 seconds to avoid double trigger in the same minute
            time.sleep(61)
        else:
            # Check every 30 seconds
            time.sleep(30)

if __name__ == "__main__":
    # If run with --now, run once and exit. Otherwise, start scheduler.
    if len(sys.argv) > 1 and sys.argv[1] == "--now":
        generate_daily_report()
    else:
        run_scheduler("06:00")
