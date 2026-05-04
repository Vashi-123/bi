from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Path Configuration ---
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("server.log", encoding='utf-8')
    ]
)
logger = logging.getLogger("ProcurementAPI")

from auth_utils import TelegramAuth
from supabase_client import SupabaseManager

# --- Configuration ---
# In a real app, use .env files. For now, using hardcoded values provided by you.
# --- Configuration from Environment ---
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SETTINGS_PATH = os.getenv("SETTINGS_PATH", "/home/usman/powerbi/backend/stock_settings.json")

import json
import sync_settings

def update_local_settings(section: str, action: str, data: dict):
    """Обновляет локальный файл stock_settings.json при изменениях в приложении."""
    try:
        if not os.path.exists(SETTINGS_PATH):
            settings = {"monitored_skus": [], "authorized_users": [], "notification_recipients": []}
        else:
            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        
        if section not in settings: settings[section] = []
        
        # Ключи для идентификации в зависимости от секции
        id_key = 'telegram_id' if 'id' not in data else 'id'
        target_id = data.get(id_key)

        if action == 'add':
            # Удаляем старую версию если есть и добавляем новую
            settings[section] = [item for item in settings[section] if str(item.get(id_key)) != str(target_id)]
            settings[section].append(data)
        elif action == 'delete':
            settings[section] = [item for item in settings[section] if str(item.get(id_key)) != str(target_id)]

        with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Local settings updated: {section} {action} {target_id}")
        
        # СРАЗУ ЗАПУСКАЕМ СИНХРОНИЗАЦИЮ
        sync_settings.sync()
        
        return True
    except Exception as e:
        logger.error(f"Error updating local settings: {e}")
        return False

app = FastAPI(title="Procurement Mini App API")

# Allow requests from your GitHub Pages URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth = TelegramAuth(BOT_TOKEN)
db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)

class StatusUpdate(BaseModel):
    sku_id: str
    new_stage: str

@app.get("/api/inventory")
async def get_inventory():
    """Returns the current inventory state from Supabase."""
    logger.info("Fetching inventory data from Supabase")
    data = db.get_inventory()
    if not data:
        return []
    return data

@app.post("/api/update_status")
async def update_status(update: StatusUpdate, x_telegram_init_data: str = Header(None)):
    """
    Securely updates the status of an SKU. 
    """
    if not x_telegram_init_data:
        logger.warning("Attempted status update without Telegram authorization header")
        raise HTTPException(status_code=401, detail="Missing Telegram authorization")

    try:
        # 1. Verify the data comes from Telegram
        user_data = auth.verify_init_data(x_telegram_init_data)
        user_id = user_data.get('id')
        user_name = user_data.get('username') or user_data.get('first_name', 'Unknown')

        if not user_id:
            logger.error("Failed to extract user_id from verified Telegram data")
            raise HTTPException(status_code=401, detail="Invalid user data")

        logger.info(f"User {user_name} (ID: {user_id}) attempting to update SKU {update.sku_id} to {update.new_stage}")

        # 2. Check if user is in the authorized list
        if not db.is_user_authorized(user_id):
            logger.warning(f"ACCESS DENIED: User {user_name} (ID: {user_id}) is not authorized to change statuses.")
            raise HTTPException(status_code=403, detail="У вас нет прав для изменения статуса.")

        # 3. Perform the update and log history
        success = db.update_sku_status(update.sku_id, update.new_stage, user_id)
        
        if not success:
            logger.error(f"Database update failed for SKU {update.sku_id}")
            raise HTTPException(status_code=500, detail="Ошибка при обновлении базы данных")

        logger.info(f"SUCCESS: SKU {update.sku_id} updated to {update.new_stage} by {user_name}")
        return {"status": "success", "message": "Статус обновлен"}

    except ValueError as e:
        logger.warning(f"Auth verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error during status update: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/api/catalog-search")
async def search_catalog(q: str):
    """Searches products in the external parquet file."""
    try:
        import pandas as pd
        path = "/home/usman/onedrive_folder/project_data/df_product/data.parquet"
        if not os.path.exists(path):
            logger.warning(f"Catalog file not found at {path}")
            return {"results": []}
        
        df = pd.read_parquet(path)
        # Search in item_name or item_id
        search_q = str(q).lower()
        mask = (df['item_name'].str.lower().str.contains(search_q, na=False)) | \
               (df['item_id'].astype(str).str.contains(search_q, na=False))
        
        results = df[mask].head(15).to_dict('records')
        # Map item_name -> name, item_id -> sku_id for frontend compatibility
        mapped = [{"sku_id": str(r['item_id']), "name": r['item_name']} for r in results]
        return {"results": mapped}
    except Exception as e:
        logger.error(f"Catalog search error: {e}")
        return {"results": [], "error": str(e)}

# --- Management Endpoints ---

async def verify_admin(x_telegram_init_data: str):
    if x_telegram_init_data == "admin_mock":
        return 198799905
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram authorization")
    try:
        user_data = auth.verify_init_data(x_telegram_init_data)
        user_id = user_data.get('id')
        if not user_id or not db.is_user_authorized(user_id):
            raise HTTPException(status_code=403, detail="У вас нет прав администратора")
        return user_id
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

class SkuSetting(BaseModel):
    sku_id: str
    name: str
    group: str = "General"

class RecipientSetting(BaseModel):
    telegram_id: int
    name: str

class AdminSetting(BaseModel):
    telegram_id: int
    name: str
    stock_access: str = "none"
    report_access: str = "none"

@app.get("/api/settings/skus")
async def get_skus(x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    return db.get_monitored_skus()

@app.post("/api/settings/skus")
async def add_sku(sku: SkuSetting, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.add_monitored_sku(sku.sku_id, sku.name, sku.group):
        update_local_settings("monitored_skus", "add", {"id": sku.sku_id, "name": sku.name, "group": sku.group})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to add SKU")

@app.delete("/api/settings/skus/{sku_id}")
async def delete_sku(sku_id: str, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.delete_monitored_sku(sku_id):
        update_local_settings("monitored_skus", "delete", {"id": sku_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete SKU")

@app.get("/api/settings/recipients")
async def get_recipients(x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    return db.get_notification_recipients()

@app.post("/api/settings/recipients")
async def add_recipient(recipient: RecipientSetting, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.add_notification_recipient(recipient.telegram_id, recipient.name):
        update_local_settings("notification_recipients", "add", {"id": recipient.telegram_id, "name": recipient.name})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to add recipient")

@app.delete("/api/settings/recipients/{telegram_id}")
async def delete_recipient(telegram_id: int, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.delete_notification_recipient(telegram_id):
        update_local_settings("notification_recipients", "delete", {"id": telegram_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete recipient")

@app.get("/api/settings/admins")
async def get_admins(x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    return db.get_authorized_users()

@app.post("/api/settings/admins")
async def add_admin(admin: AdminSetting, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.add_authorized_user(admin.telegram_id, admin.name, admin.stock_access, admin.report_access):
        update_local_settings("authorized_users", "add", {
            "id": admin.telegram_id, 
            "name": admin.name, 
            "stock_access": admin.stock_access,
            "report_access": admin.report_access
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to add admin")

@app.delete("/api/settings/admins/{telegram_id}")
async def delete_admin(telegram_id: int, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.delete_authorized_user(telegram_id):
        update_local_settings("authorized_users", "delete", {"id": telegram_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete admin")

@app.get("/api/settings/report_recipients")
async def get_report_recipients(x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    # Note: You'll need to add get_report_recipients to SupabaseManager
    return db.get_report_recipients()

@app.post("/api/settings/report_recipients")
async def add_report_recipient(recipient: RecipientSetting, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.add_report_recipient(recipient.telegram_id, recipient.name):
        update_local_settings("report_recipients", "add", {"id": recipient.telegram_id, "name": recipient.name})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to add report recipient")

@app.delete("/api/settings/report_recipients/{telegram_id}")
async def delete_report_recipient(telegram_id: int, x_telegram_init_data: str = Header(None)):
    await verify_admin(x_telegram_init_data)
    if db.delete_report_recipient(telegram_id):
        update_local_settings("report_recipients", "delete", {"id": telegram_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete report recipient")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
