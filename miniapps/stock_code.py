import pandas as pd
import numpy as np
import requests
import json
import io
import os
import sys
import pyarrow.dataset as ds
# --- ТЕЛЕГРАМ & SETTINGS ---
TG_BOT_TOKEN = "8719774319:AAF32nPaw10bPMrfTfEKDyGcTO13U54Mo4c"
# Supabase for sync
SUPABASE_URL = "https://mmsjmkvkytiehqdvsclt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tc2pta3ZreXRpZWhxZHZzY2x0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0ODM3MSwiZXhwIjoyMDkyNDI0MzcxfQ.R93Uw0jHyirg3JRC3lcVOCDqg-NEDpEMAfcRrlXv-sI"

# Пути на сервере
SETTINGS_PATH = "/home/usman/powerbi/backend/stock_settings.json"
backend_path = "/home/usman/miniapps/backend"

if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from supabase_client import SupabaseManager
db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)

def load_settings():
    try:
        if not os.path.exists(SETTINGS_PATH):
            return {}
        with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Ошибка загрузки настроек: {e}")
        return {}

settings = load_settings()

# Получаем получателей уведомлений
notification_recipients = settings.get('notification_recipients', [])
TG_CHAT_IDS = [str(r['id']) for r in notification_recipients]
print(f"🔔 Найдено {len(TG_CHAT_IDS)} получателей уведомлений.")

# Получаем список SKU для мониторинга
monitored_skus = settings.get('monitored_skus', [])
target_item_ids = [str(s['id']).strip() for s in monitored_skus]
sku_groups = {str(s['id']).strip(): s.get('group', 'Общая') for s in monitored_skus}

print(f"📦 Из настроек загружено {len(target_item_ids)} SKU для мониторинга: {', '.join(target_item_ids)}")

if not target_item_ids:
    print("⚠️ ВНИМАНИЕ: Список SKU для мониторинга пуст в настройках!")

def send_telegram_html_file(html_content, filename="Stock_Report.html"):
    # Подготавливаем файл один раз
    file_bytes = io.BytesIO(html_content.encode('utf-8'))
    
    # ПЕРЕБИРАЕМ ВСЕ ID ИЗ СПИСКА
    for chat_id in TG_CHAT_IDS:
        url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendDocument"
        
        # Важно: "перематываем" файл в начало перед каждой отправкой
        file_bytes.seek(0)
        
        data = {
            'chat_id': chat_id, # Отправляем конкретному пользователю
            'caption': f"📊 Отчет по складу: Требуется пополнение ({filename})"
        }
        files = {
            'document': (filename, file_bytes, 'text/html')
        }
        
        try:
            response = requests.post(url, data=data, files=files, timeout=20)
            if response.status_code == 200:
                print(f"✅ Отчет успешно отправлен в чат {chat_id}")
            else:
                print(f"❌ Ошибка отправки в чат {chat_id}: {response.text}")
        except Exception as e:
            print(f"⚠️ Ошибка подключения при отправке в {chat_id}: {e}")


def send_telegram_msg(message):
    for chat_id in TG_CHAT_IDS:
        url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
        try:
            requests.post(url, json=payload, timeout=10)
        except Exception as e:
            print(f"⚠️ Ошибка отправки в Телеграм ({chat_id}): {e}")
# 2. ЗАГРУЗКА ТЕКУЩЕГО СТОКА (df_stock)
folder_path_stock = '/home/usman/onedrive_folder/project_data/df_stock/'
subdirs_stock = sorted([
    d for d in os.listdir(folder_path_stock)
    if os.path.isdir(os.path.join(folder_path_stock, d)) and d.startswith("date=")
])[-35:]

file_paths_stock = []
for d in subdirs_stock:
    day_folder = os.path.join(folder_path_stock, d)
    for f in os.listdir(day_folder):
        if f.endswith('.parquet'):
            file_paths_stock.append(os.path.join(day_folder, f))

dataset_stock = ds.dataset(file_paths_stock, format="parquet", partitioning=None)
df_stock = dataset_stock.to_table().to_pandas()

# Чистим ID в базе
for col in ['item_id', 'item_name', 'product_name']:
    if col in df_stock.columns:
        df_stock[col] = df_stock[col].astype(str).str.strip()

# ПРОВЕРКА НАЙДЕННЫХ ЗНАЧЕНИЙ
unique_ids_in_df = set(df_stock['item_id'].unique())
missing_ids = set(target_item_ids) - unique_ids_in_df

print("\n" + "="*30)
print("🔍 СТАТУС ПОИСКА ТОВАРОВ")
if missing_ids:
    print(f"⚠️ ВНИМАНИЕ! Следующие ID НЕ найдены: {missing_ids}")
else:
    print(f"✅ Все целевые товары ({len(target_item_ids)} шт.) найдены!")
print("="*30 + "\n")

# Оставляем в работе только целевые товары
stocke_code = df_stock[df_stock['item_id'].isin(target_item_ids)].copy()

# %%
# 3. ЗАГРУЗКА ИСТОРИИ ПРОДАЖ (dfps) - Последние 35 дней
folder_path_only = '/home/usman/onedrive_folder/project_data/df_only'
subdirs_only = sorted([
    os.path.join(folder_path_only, d) for d in os.listdir(folder_path_only) 
    if os.path.isdir(os.path.join(folder_path_only, d)) and d.startswith("date=")
])[-35:]

file_paths_only = []
for d in subdirs_only:
    for f in os.listdir(d):
        if f.endswith('.parquet'):
            file_paths_only.append(os.path.join(d, f))

dataset_only = ds.dataset(file_paths_only, format="parquet", partitioning=None)
dfps = dataset_only.to_table().to_pandas()

# Фильтрация истории (только успешные продажи ваучеров)
dfps_filtered = dfps[(dfps['status'] == 'SUCCESS') & (dfps['type'] == 'VOUCHER_SALE')].copy()
print(f"📊 Загружено {dfps.shape[0]} строк истории, после фильтрации: {dfps_filtered.shape[0]}")

# Проверка: есть ли продажи по нашим товарам вообще?
sales_check = dfps_filtered[dfps_filtered['item_id'].astype(str).isin(target_item_ids)].copy()
print(f"📈 Найдено {sales_check.shape[0]} записей о продажах целевых товаров в истории.")

if not sales_check.empty:
    print("\n🔝 ТОП-10 ПРОДАЖ ИЗ ИСТОРИИ (для проверки форматов):")
    # Группируем для наглядности
    check_summary = sales_check.groupby(['item_id', 'created_at_ymd'])['qty'].sum().reset_index()
    print(check_summary.sort_values('qty', ascending=False).head(10))
    print("="*30)

# Группируем расход и цену
groupc = dfps_filtered.groupby(['item_id','created_at_ymd'])['qty'].sum().reset_index()
avg_price = dfps_filtered.groupby(['item_id', 'created_at_ymd'])['unitamount_usd'].mean().reset_index()

groupc_to_merge = groupc.rename(columns={'created_at_ymd': 'date', 'qty': 'Daily_Spend'})
avg_price_to_merge = avg_price.rename(columns={'created_at_ymd': 'date', 'unitamount_usd': 'Avg_UnitAmount_USD'})

# --- ЖЕСТКАЯ НОРМАЛИЗАЦИЯ ДЛЯ СЛИЯНИЯ ---
def normalize_date(df, col):
    # Превращаем в datetime, а потом обратно в строку только даты (YYYY-MM-DD)
    df[col] = pd.to_datetime(df[col]).dt.strftime('%Y-%m-%d')
    return df

def normalize_id(df, col):
    df[col] = df[col].astype(str).str.strip()
    return df

# Чистим сток
stocke_code = normalize_id(stocke_code, 'item_id')
stocke_code = normalize_date(stocke_code, 'date')

# Чистим продажи
groupc_to_merge = normalize_id(groupc_to_merge, 'item_id')
groupc_to_merge = normalize_date(groupc_to_merge, 'date')

avg_price_to_merge = normalize_id(avg_price_to_merge, 'item_id')
avg_price_to_merge = normalize_date(avg_price_to_merge, 'date')

# Удаляем колонки если уже существуют (защита от повторного запуска)
stocke_code = stocke_code.drop(columns=['Daily_Spend', 'Avg_UnitAmount_USD'], errors='ignore')

# Сливаем
stocke_code = stocke_code.merge(groupc_to_merge[['item_id', 'date', 'Daily_Spend']], on=['item_id', 'date'], how='left')
stocke_code = stocke_code.merge(avg_price_to_merge[['item_id', 'date', 'Avg_UnitAmount_USD']], on=['item_id', 'date'], how='left')

stocke_code['Daily_Spend'] = stocke_code['Daily_Spend'].fillna(0)
stocke_code['Avg_UnitAmount_USD'] = stocke_code['Avg_UnitAmount_USD'].fillna(0)

print("\n✅ ПРОВЕРКА СЛИЯНИЯ (Товары с реальным расходом):")
matched_sales = stocke_code[stocke_code['Daily_Spend'] > 0]
if not matched_sales.empty:
    print(matched_sales[['date', 'item_id', 'Daily_Spend']].sort_values('date', ascending=False).head(10))
else:
    print("⚠️ ПРЕДУПРЕЖДЕНИЕ: После слияния не найдено ни одной строки с расходом > 0!")
print("="*30)


# %%
stocke_code.sort_values(by = 'quantity' , ascending = False).head(5)

# %%
import pandas as pd
import numpy as np

def enterprise_liquidity_engine_v2(df):
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'], format='ISO8601', utc=True).dt.tz_convert('Asia/Dubai').dt.tz_localize(None)
    df = df.sort_values(['item_id', 'date'])

    # --- 1. Корректный расчет Daily_Deposit (Пополнения) ---
    df['Next_Day_quantity'] = df.groupby('item_id')['quantity'].shift(-1)
    df['Daily_Deposit'] = df['Next_Day_quantity'] - (df['quantity'] - df['Daily_Spend'])
    df['Daily_Deposit'] = df['Daily_Deposit'].apply(lambda x: round(x, 2) if x > 0.01 else 0)

    # --- 2. Скользящие средние и волатильность расхода ---
    # MA30 для базы, STD30 для понимания "нормального" разброса продаж
    group_spend = df.groupby('item_id')['Daily_Spend']
    df['MA7_Spend'] = group_spend.transform(lambda x: x.rolling(window=7, min_periods=0).mean())
    df['MA30_Spend'] = group_spend.transform(lambda x: x.rolling(window=30, min_periods=0).mean())
    df['STD30_Spend'] = group_spend.transform(lambda x: x.rolling(window=30, min_periods=1).std()).fillna(0)

    # --- 3. Скользящие средние цены и Выручка ---
    group_price = df.groupby('item_id')['Avg_UnitAmount_USD']
    df['MA7_UnitAmount'] = group_price.transform(lambda x: x.rolling(window=7, min_periods=1).mean())
    df['MA30_UnitAmount'] = group_price.transform(lambda x: x.rolling(window=30, min_periods=1).mean())

    df['Daily_Revenue_USD'] = df['Daily_Spend'] * df['Avg_UnitAmount_USD']
    
    group_rev = df.groupby('item_id')['Daily_Revenue_USD']
    df['Weekly_Revenue_USD'] = group_rev.transform(lambda x: x.rolling(window=7, min_periods=1).sum())
    df['Monthly_Revenue_USD'] = group_rev.transform(lambda x: x.rolling(window=30, min_periods=1).sum())

    # --- 4. Профессиональный детектор аномалий ---
    # Аномалия расхода: Расход выше (Среднее + 3 Сигмы) И расход больше 5 единиц (фильтр шума)
    df['Is_Anomaly'] = (
        (df['Daily_Spend'] > (df['MA30_Spend'] + 3 * df['STD30_Spend'])) & 
        (df['Daily_Spend'] > 5)
    )
    
    # Аномалия цены: рост более чем на 20% от недельной средней
    df['Is_Anomaly_Price'] = (
        (df['Avg_UnitAmount_USD'] > (df['MA7_UnitAmount'] * 1.2)) &
        (df['MA7_UnitAmount'] > 0)
    )

    # --- 5. Расчет необходимого долива ---
    z_score_inventory = 1.65 # Для 95% уверенности в наличии товара

# Добавили параметр target_days=3
    def calc_need_to_top_up(group, target_days=3):
            # Подготовим нули для быстрых возвратов
            zeros = pd.Series(0, index=group.index)
            
            # 1. Если товара нет и нет продаж вообще — пропускаем
            if (group['quantity'] == 0).all() and (group['Daily_Spend'].sum() == 0):
                return pd.DataFrame({'need': zeros, 'forecast': zeros})

            # 2. Берем историю продаж (без обрезки пиков)
            active_spend = group['Daily_Spend'].replace(0, np.nan)

            # 3. Считаем скользящие средние
            ma7_active  = active_spend.rolling(window=7, min_periods=1).mean().fillna(0)
            ma30_active = active_spend.rolling(window=30, min_periods=1).mean().fillna(0)

            # 4. Динамический прогноз расхода (Умные веса)
            # Если недельный тренд выше месячного (спрос растет) -> даем 70% веса свежим данным
            # Если спрос ровный или падает -> оставляем классические 50/50
            forecast_array = np.where(
                ma7_active > ma30_active,
                ma7_active,
                (ma7_active * 0.5) + (ma30_active * 0.5)
            )
            
            # Оборачиваем обратно в pandas Series, чтобы индексы не потерялись
            avg_forecast = pd.Series(forecast_array, index=group.index)
            
            # 5. Целевой запас (Прогноз * 3 дня)
            target_stock = avg_forecast * target_days
            # 6. Вычисляем потребность (целевой запас минус то, что уже есть на складе)
            need = (target_stock - group['quantity']).clip(lower=0).round(2)
            
            return pd.DataFrame({'need': need, 'forecast': avg_forecast.round(2)})

# Применяем расчет, явно указывая, на сколько дней хотим сделать запас (target_days=3)
    calc_results = df.groupby('item_id', group_keys=False).apply(
        lambda g: calc_need_to_top_up(g, target_days=3)
    )
    
    # Распаковываем результаты в основной датафрейм
    df['Нужно долить шт'] = calc_results['need']
    df['Расчетный прогноз расхода'] = calc_results['forecast']

    # Округление до ближайшего десятка в большую сторону (для ШТУК)
    df['Нужно долить шт'] = np.ceil(df['Нужно долить шт'] / 10) * 10


    current_price = df['Avg_UnitAmount_USD'].where(df['Avg_UnitAmount_USD'] > 0, df['MA7_UnitAmount']) \
                                            .where(df['MA7_UnitAmount'] > 0, df['MA30_UnitAmount'])
    
    df['Нужно долить $'] = df['Нужно долить шт'] * current_price
# --- 4. Дней до нуля ---
    # Делим текущий остаток на наш новый умный прогноз
    df['Days_to_Zero'] = df['quantity'] / df['Расчетный прогноз расхода']
    
    # Защита от деления на ноль: меняем бесконечность и пустые значения на 999
    df['Days_to_Zero'] = df['Days_to_Zero'].replace([np.inf, -np.inf], 999).fillna(999).round(1)
    # --- 7. Формирование финального отчета (Summary) ---
    summary = []
    for name, group in df.groupby('item_id'):
        last_row = group.iloc[-1]
        
        summary.append({
            'item_id':              name,
            'item_name':            last_row.get('item_name', ''),
            'product_name':         last_row.get('product_name', ''),
            'Количество (сегодня)': round(last_row['quantity'], 2),
            'Вчерашний приход':     group['Daily_Deposit'].iloc[-2] if len(group) > 1 else 0,
            'Ср. расход (30д)':      round(last_row['MA30_Spend'], 2),
            'Текущий расход':        round(last_row['Daily_Spend'], 2),
            'Цена сегодня':          round(last_row['Avg_UnitAmount_USD'], 2),
            'Ср. цена (30д)':        round(last_row['MA30_UnitAmount'], 2),
            'Расчетный прогноз расхода': last_row['Расчетный прогноз расхода'],
            'Выручка за 30д $':      round(last_row['Monthly_Revenue_USD'], 2),
            'Аномалия расход?':      '🚨 ДА' if last_row['Is_Anomaly'] else '✅ Нет',
            'Аномалия цена?':        '🚨 ДА' if last_row['Is_Anomaly_Price'] else '✅ Нет',
            'Дней до нуля':          last_row['Days_to_Zero'],
            'Нужно пополнить (шт)':  last_row['Нужно долить шт'],
            'Нужно долить $':        round(last_row['Нужно долить $'], 2),
        })

    return df.drop(columns=['Next_Day_quantity', 'STD30_Spend', 'Нужно долить шт']), pd.DataFrame(summary)

# %%
# 5. ЗАПУСК ДВИЖКА АНАЛИТИКИ
full_df, summary_report = enterprise_liquidity_engine_v2(stocke_code)

# Добавляем дату и статусы
from datetime import datetime
now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
summary_report['Дата отчета'] = now_str
summary_report['Дата статуса'] = now_str

def assign_status(row):
    days_left = row['Дней до нуля']
    forecast = row['Расчетный прогноз расхода']
    if days_left <= 1 and forecast > 0: return '🚨 Критично'
    elif days_left <= 3 and forecast > 0: return '⚠️ Требуется пополнение'
    elif row['Выручка за 30д $'] == 0 and row['Количество (сегодня)'] == 0: return '💀 Мёртвый сток'
    elif row['Выручка за 30д $'] == 0: return '💤 Нет продаж'
    else: return '✅ Достаточно'

summary_report['Статус'] = summary_report.apply(assign_status, axis=1)
summary_report['item_id'] = summary_report['item_id'].astype(int)

# %%
# 6. СОХРАНЕНИЕ РЕЗУЛЬТАТОВ
today_str = datetime.now().strftime('%Y-%m-%d')
folder_path = f'/home/usman/onedrive_folder/project_data/stock_code/date={today_str}'
os.makedirs(folder_path, exist_ok=True)

parquet_path = f'{folder_path}/report.parquet'
summary_report.to_parquet(parquet_path, index=False)

# Также сохраняем плоский файл для истории (совместимость)
history_path = f'/home/usman/onedrive_folder/project_data/stock_code/report_date={today_str}.parquet'
summary_report.to_parquet(history_path, index=False)

print(f"✅ Финальный отчет сохранен: {history_path}")
print("\nФИНАЛЬНЫЙ РЕЗУЛЬТАТ (Топ по расходу):")
print(summary_report.sort_values('Ср. расход (30д)', ascending=False).head(10))

# --- СИНХРОНИЗАЦИЯ НАСТРОЕК И ДАННЫХ ---
print("🔄 Начинаем синхронизацию...")
try:
    # 1. Синхронизируем настройки (Пользователи, SKU, Получатели) через отдельный модуль
    import sync_settings
    sync_settings.sync()
    
    # 2. Синхронизируем данные по остаткам (результаты анализа)
    # Настройки Supabase
    allowed_statuses = ['🚨 Критично', '⚠️ Требуется пополнение', '✅ Достаточно']
    
    records = []
    for _, row in summary_report.iterrows():
        status = row.get('Статус')
        if status in allowed_statuses:
            stage = 'needs'
            if status == '✅ Достаточно':
                stage = 'sufficient'

            records.append({
                "id": str(int(row['item_id'])),
                "name": row['item_name'],
                "product_name": row['product_name'],
                "group": sku_groups.get(str(int(row['item_id'])), "Общая"), 
                "qty": float(row['Количество (сегодня)']),
                "days": float(row['Дней до нуля']),
                "need": float(row['Нужно пополнить (шт)']),
                "daily_spend": float(row['Расчетный прогноз расхода']),
                "stage": stage
            })
            
    if not records:
        print("✅ Нет товаров с критическим статусом для синхронизации данных.")
    else:
        if db.sync_parquet_data(records):
            print(f"✅ Успешно синхронизировано {len(records)} товаров!")
        else:
            print("❌ Ошибка при отправке данных в Supabase.")
            sys.exit(1)
            
except Exception as e:
    print(f"❌ Ошибка при синхронизации: {str(e)}")
    sys.exit(1)
