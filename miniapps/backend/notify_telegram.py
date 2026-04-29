import requests
import logging
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# Добавляем путь к папке backend, чтобы скрипт видел supabase_client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import SupabaseManager
import argparse

logger = logging.getLogger(__name__)

# --- Configuration ---
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SETTINGS_PATH = os.getenv("SETTINGS_PATH", "/home/usman/powerbi/backend/stock_settings.json")
def send_telegram_message(text: str, chat_ids: list):
    """Sends an HTML formatted message via Telegram Bot API to multiple users."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    
    for chat_id in chat_ids:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": False
        }
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            print(f"✅ Telegram notification sent successfully to {chat_id}!")
        except Exception as e:
            print(f"❌ Failed to send Telegram notification to {chat_id}: {e}")


import json

def main():
    print("🔄 Checking Supabase for SKUs that need purchasing...")
    db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Fetch inventory (из Supabase, чтобы знать актуальные стадии)
    inventory = db.get_inventory()
    
    # 2. Count SKUs in "needs" stage
    needs_count = sum(1 for item in inventory if item.get('stage') == 'needs')
    
    # 3. Fetch recipients from LOCAL SETTINGS
    chat_ids = []
    try:
        with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            recipients = settings.get('notification_recipients', [])
            chat_ids = [str(r['id']) for r in recipients]
    except Exception as e:
        print(f"❌ Error loading local settings: {e}")
    
    if not chat_ids:
        print(f"⚠️ No notification recipients found in {SETTINGS_PATH}")
        return

    # 4. Format message
    if needs_count > 0:
        message = (
            "🚨 <b>Сток обновлен!</b>\n\n"
            f"У вас <b>{needs_count} SKU</b>, которые нужно закупить.\n\n"
            f"🔗 Откройте Mini App для управления статусами"
        )
    else:
        message = (
            "✅ <b>Сток обновлен!</b>\n\n"
            "Сегодня закупать ничего не нужно.\n\n"
        )
        
    print(f"📦 Needs count: {needs_count}")
    
    # 5. Send message
    send_telegram_message(message, chat_ids)

import time
from datetime import datetime

def run_scheduler(target_time="10:00"):
    logger.info(f"🚀 Stock Notifier Scheduler started. Targets: Mon/Thu at {target_time}")
    notification_done_today = False
    
    while True:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        weekday = now.weekday() # 0 = Monday, 3 = Thursday

        # Reset flag at midnight
        if current_time == "00:00":
            notification_done_today = False

        # Check if it's Mon(0) or Thu(3) and the right time
        if weekday in [0, 3] and current_time == target_time and not notification_done_today:
            logger.info("🔔 Scheduled notification time reached!")
            main()
            notification_done_today = True
            logger.info("✅ Notification sent. Waiting for the next scheduled day...")
            time.sleep(61)
        else:
            # Check every 30 seconds
            time.sleep(30)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
    
    if len(sys.argv) > 1 and sys.argv[1] == "--now":
        main()
    else:
        run_scheduler("10:00")
