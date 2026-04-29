import requests
import logging
import sys
import os

# Добавляем путь к папке backend, чтобы скрипт видел supabase_client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import SupabaseManager
import argparse

logger = logging.getLogger(__name__)

# --- Configuration ---
# You can replace these with environment variables in a production setup
BOT_TOKEN = "8719774319:AAF32nPaw10bPMrfTfEKDyGcTO13U54Mo4c"
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

SUPABASE_URL = "https://mmsjmkvkytiehqdvsclt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tc2pta3ZreXRpZWhxZHZzY2x0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0ODM3MSwiZXhwIjoyMDkyNDI0MzcxfQ.R93Uw0jHyirg3JRC3lcVOCDqg-NEDpEMAfcRrlXv-sI"

import json

def main():
    print("🔄 Checking Supabase for SKUs that need purchasing...")
    db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Fetch inventory (из Supabase, чтобы знать актуальные стадии)
    inventory = db.get_inventory()
    
    # 2. Count SKUs in "needs" stage
    needs_count = sum(1 for item in inventory if item.get('stage') == 'needs')
    
    # 3. Fetch recipients from LOCAL SETTINGS
    SETTINGS_PATH = "/home/usman/powerbi/backend/stock_settings.json"
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

if __name__ == "__main__":
    main()
