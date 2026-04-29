import json
import os
import sys

# --- Configuration ---
SUPABASE_URL = "https://mmsjmkvkytiehqdvsclt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tc2pta3ZreXRpZWhxZHZzY2x0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0ODM3MSwiZXhwIjoyMDkyNDI0MzcxfQ.R93Uw0jHyirg3JRC3lcVOCDqg-NEDpEMAfcRrlXv-sI"
SETTINGS_PATH = "/home/usman/powerbi/backend/stock_settings.json"
BACKEND_PATH = "/home/usman/miniapps/backend"

if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

try:
    from supabase_client import SupabaseManager
    db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
except ImportError:
    print("❌ Ошибка: Не удалось импортировать SupabaseManager. Проверьте пути.")
    sys.exit(1)

def load_settings():
    if not os.path.exists(SETTINGS_PATH):
        print(f"⚠️ Файл настроек не найден: {SETTINGS_PATH}")
        return None
    try:
        with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка чтения JSON: {e}")
        return None

def sync():
    print("🔄 Запуск синхронизации настроек...")
    settings = load_settings()
    if not settings:
        return

    # 1. СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ
    auth_users = settings.get('authorized_users', [])
    print(f"👥 Синхронизация пользователей ({len(auth_users)})...")
    
    supabase_users = db.get_authorized_users()
    local_admin_ids = {str(u['id']) for u in auth_users}
    
    # Удаляем лишних
    for s_user in supabase_users:
        s_id = str(s_user['telegram_id'])
        if s_id not in local_admin_ids:
            print(f"  🗑️ Удаляем админа: {s_id}")
            db.delete_authorized_user(int(s_id))
            
    # Добавляем/Обновляем
    for user in auth_users:
        db.add_authorized_user(int(user['id']), user['name'], user.get('access', 'view'))

    # 2. СИНХРОНИЗАЦИЯ SKU
    monitored_skus = settings.get('monitored_skus', [])
    print(f"📦 Синхронизация SKU ({len(monitored_skus)})...")
    
    supabase_skus = db.get_monitored_skus()
    local_sku_ids = {str(s['id']) for s in monitored_skus}
    
    for s_sku in supabase_skus:
        s_id = str(s_sku['sku_id'])
        if s_id not in local_sku_ids:
            print(f"  🗑️ Удаляем SKU: {s_id}")
            db.delete_monitored_sku(s_id)
            
    for sku in monitored_skus:
        db.add_monitored_sku(str(sku['id']), sku['name'])

    # 3. СИНХРОНИЗАЦИЯ ПОЛУЧАТЕЛЕЙ УВЕДОМЛЕНИЙ
    recipients = settings.get('notification_recipients', [])
    print(f"🔔 Синхронизация получателей ({len(recipients)})...")
    
    supabase_recipients = db.get_notification_recipients()
    local_rec_ids = {str(r['id']) for r in recipients}
    
    for s_rec in supabase_recipients:
        s_id = str(s_rec['telegram_id'])
        if s_id not in local_rec_ids:
            print(f"  🗑️ Удаляем получателя: {s_id}")
            db.delete_notification_recipient(int(s_id))
            
    for rec in recipients:
        db.add_notification_recipient(int(rec['id']), rec['name'])

    print("✅ Синхронизация настроек успешно завершена!")

if __name__ == "__main__":
    sync()
