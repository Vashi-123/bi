import requests
import json
import logging
from datetime import datetime
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
# --- CONFIGURATION FROM ENVIRONMENT ---
TG_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Import Supabase Manager
sys.path.append(os.path.dirname(__file__))
from supabase_client import SupabaseManager

db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)


def send_telegram_msg(chat_id, message):
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True
    }
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            logger.info(f"✅ Report sent to {chat_id}")
        else:
            logger.error(f"❌ Failed to send to {chat_id}: {resp.text}")
    except Exception as e:
        logger.error(f"⚠️ Error sending to {chat_id}: {e}")

def broadcast_report():
    logger.info("🚀 Starting report broadcast...")
    
    # 1. Fetch Recipients
    recipients = db.get_report_recipients()
    if not recipients:
        logger.warning("⚠️ No recipients found in report_recipients table.")
        return

    # 2. Fetch Latest Report
    try:
        response = db.supabase.table('analytical_reports').select("data, updated_at").eq("report_id", "daily_analytics").single().execute()
        if not response.data:
            logger.warning("⚠️ No report data found for 'daily_analytics'.")
            return
        
        report_data = response.data['data']
        updated_at = response.data['updated_at']
    except Exception as e:
        logger.error(f"❌ Error fetching report from Supabase: {e}")
        return

    # 3. Construct Message
    period = report_data.get('period_info', {}).get('period_b', {})
    report_date = period.get('start', '...')
    
    msg = f"📊 *Ежедневный отчет готов* (`{report_date}`)\n\n"
    msg += "🔗 Откройте Mini App, чтобы посмотреть отчет"



    # 4. Send to all
    for r in recipients:
        send_telegram_msg(r['telegram_id'], msg)

    logger.info("✅ Broadcast complete.")

if __name__ == "__main__":
    broadcast_report()
