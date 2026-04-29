from supabase import create_client, Client
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class SupabaseManager:
    def __init__(self, url: str, key: str):
        self.supabase: Client = create_client(url, key)

    def get_inventory(self) -> List[Dict]:
        """Fetches the current inventory state from Supabase."""
        try:
            response = self.supabase.table('inventory').select("*").execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching inventory: {str(e)}")
            return []

    def is_user_authorized(self, telegram_id: int) -> bool:
        """Checks if a Telegram user is in the authorized_users table."""
        try:
            response = self.supabase.table('authorized_users') \
                .select("telegram_id") \
                .eq("telegram_id", telegram_id) \
                .execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error checking authorization: {str(e)}")
            return False

    def update_sku_status(self, sku_id: str, new_stage: str, user_id: int) -> bool:
        """
        Updates the status of an SKU and logs the change in history.
        Uses a simple transaction-like logic (fetch current, update, log).
        """
        try:
            # 1. Fetch current stage for history logging
            current_sku = self.supabase.table('inventory') \
                .select("stage") \
                .eq("sku_id", sku_id) \
                .single() \
                .execute()
            
            from_stage = current_sku.data.get('stage') if current_sku.data else 'unknown'

            # 2. Update the status
            self.supabase.table('inventory') \
                .update({"stage": new_stage, "updated_at": "now()"}) \
                .eq("sku_id", sku_id) \
                .execute()

            # 3. Log to history
            self.supabase.table('status_history').insert({
                "sku_id": sku_id,
                "from_stage": from_stage,
                "to_stage": new_stage,
                "changed_by": user_id
            }).execute()

            return True
        except Exception as e:
            logger.error(f"Error updating status for {sku_id}: {str(e)}")
            return False

    def sync_parquet_data(self, df_records: List[Dict]) -> bool:
        """
        Syncs data from analysis script to Supabase.
        Critically, it ensures that if an SKU already exists in a status 
        other than 'needs', it won't be reset or duplicated.
        """
        try:
            for record in df_records:
                sku_id = str(record['id'])
                
                payload = {
                    "sku_id": sku_id,
                    "name": record['name'],
                    "product_name": record.get('product_name', ''),
                    "group": record['group'],
                    "qty": record['qty'],
                    "days_left": record['days'],
                    "need": record['need'],
                    "daily_spend": record.get('daily_spend', 0),
                    "updated_at": "now()"
                }

                # 1. Check if the item already exists
                existing = self.supabase.table('inventory').select("stage").eq("sku_id", sku_id).execute()
                
                if existing.data and len(existing.data) > 0:
                    current_stage = existing.data[0].get('stage')
                    new_stage = record.get('stage', 'needs')
                    
                    # Строгая синхронизация только между базовыми статусами:
                    # 1. Переводим в 'sufficient', только если до этого было 'needs'
                    # 2. Переводим в 'needs', только если до этого было 'sufficient'
                    # Все остальные статусы (в ожидании, готово, закуплено) - игнорируем
                    if new_stage == 'sufficient' and current_stage == 'needs':
                        payload['stage'] = 'sufficient'
                    elif new_stage == 'needs' and current_stage == 'sufficient':
                        payload['stage'] = 'needs'
                    
                    self.supabase.table('inventory').update(payload).eq("sku_id", sku_id).execute()
                else:
                    # It's a new item
                    payload['stage'] = record.get('stage', 'needs')
                    self.supabase.table('inventory').insert(payload).execute()
                    
            return True
        except Exception as e:
            print(f"❌ SUPABASE SYNC ERROR: {str(e)}")
            logger.error(f"Error syncing parquet data: {str(e)}")
            return False

    # --- Management Methods ---

    def get_monitored_skus(self) -> List[Dict]:
        try:
            response = self.supabase.table('monitored_skus').select("*").execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching monitored SKUs: {str(e)}")
            return []

    def add_monitored_sku(self, sku_id: str, name: str) -> bool:
        try:
            self.supabase.table('monitored_skus').upsert(
                {"sku_id": sku_id, "name": name},
                on_conflict="sku_id"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error adding monitored SKU: {str(e)}")
            return False

    def delete_monitored_sku(self, sku_id: str) -> bool:
        try:
            self.supabase.table('monitored_skus').delete().eq("sku_id", sku_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting monitored SKU: {str(e)}")
            return False

    def get_notification_recipients(self) -> List[Dict]:
        try:
            response = self.supabase.table('notification_recipients').select("*").execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching notification recipients: {str(e)}")
            return []

    def add_notification_recipient(self, telegram_id: int, name: str) -> bool:
        try:
            self.supabase.table('notification_recipients').upsert(
                {"telegram_id": telegram_id, "name": name},
                on_conflict="telegram_id"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error adding notification recipient: {str(e)}")
            return False

    def delete_notification_recipient(self, telegram_id: int) -> bool:
        try:
            self.supabase.table('notification_recipients').delete().eq("telegram_id", telegram_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting notification recipient: {str(e)}")
            return False

    def get_authorized_users(self) -> List[Dict]:
        try:
            response = self.supabase.table('authorized_users').select("telegram_id, name, stock_access, report_access").execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching authorized users: {str(e)}")
            return []

    def add_authorized_user(self, telegram_id: int, name: str, stock_access: str = "none", report_access: str = "none") -> bool:
        try:
            self.supabase.table('authorized_users').upsert({
                "telegram_id": telegram_id, 
                "name": name,
                "stock_access": stock_access,
                "report_access": report_access
            }, on_conflict="telegram_id").execute()
            return True
        except Exception as e:
            logger.error(f"Error adding authorized user: {str(e)}")
            return False

    def delete_authorized_user(self, telegram_id: int) -> bool:
        try:
            self.supabase.table('authorized_users').delete().eq("telegram_id", telegram_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting authorized user: {str(e)}")
            return False

    def upsert_analytical_report(self, report_id: str, payload: Dict) -> bool:
        """Stores a calculated analytical snapshot in Supabase for quick retrieval and history."""
        try:
            self.supabase.table('analytical_reports').upsert({
                "report_id": report_id,
                "data": payload,
                "updated_at": "now()"
            }, on_conflict="report_id").execute()
            return True
        except Exception as e:
            logger.error(f"Error upserting analytical report: {str(e)}")
            return False

    def get_report_recipients(self) -> List[Dict]:
        try:
            response = self.supabase.table('report_recipients').select("*").execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching report recipients: {str(e)}")
            return []

    def add_report_recipient(self, telegram_id: int, name: str) -> bool:
        try:
            self.supabase.table('report_recipients').upsert(
                {"telegram_id": telegram_id, "name": name},
                on_conflict="telegram_id"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error adding report recipient: {str(e)}")
            return False

    def delete_report_recipient(self, telegram_id: int) -> bool:
        try:
            self.supabase.table('report_recipients').delete().eq("telegram_id", telegram_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting report recipient: {str(e)}")
            return False
