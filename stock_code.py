import pandas as pd
import numpy as np
import requests
import json

pd.options.display.float_format = '{:,.2f}'.format
pd.set_option('display.max_rows', None)
pd.set_option('display.max_columns', None)
pd.set_option('display.max_seq_items', None)

import io
import requests
# --- ТЕЛЕГРАМ ---
TG_BOT_TOKEN = "8719774319:AAF32nPaw10bPMrfTfEKDyGcTO13U54Mo4c"
TG_CHAT_IDS = ["198799905", "8513763454", "6150658676", "2137263208"] 


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

# %%
import pandas as pd
import pyarrow.dataset as ds

import os

folder_path = '/home/usman/onedrive_folder/project_data/df_stock/'
 
# Берем только последние 35 дней (сортировка по имени папки = по дате)
subdirs = sorted([
    d for d in os.listdir(folder_path)
    if os.path.isdir(os.path.join(folder_path, d)) and d.startswith("date=")
])[-35:]

# Собираем пути к файлам
file_paths = []
for d in subdirs:
    day_folder = os.path.join(folder_path, d)
    for f in os.listdir(day_folder):
        if f.endswith('.parquet'):
            file_paths.append(os.path.join(day_folder, f))

dataset = ds.dataset(file_paths, format="parquet", partitioning=None)
df_stock = dataset.to_table().to_pandas()

print(df_stock.shape)
print(df_stock.head())

# 👇 Вставь сюда:
print("Уникальных дат в df_stock:", df_stock['date'].nunique())
print(df_stock['date'].unique())


# %%
# %%
# Список целевых item_id для поиска
target_item_ids = [
    "6552", "6681", # Группа 1
    "7641", "7384", "7385", # Группа 2
    "7475", "7476", # Группа 3
    "7574", "7575", # Группа 4
    "7624" # Группа 5
]

# %%
import pandas as pd
import numpy as np

# 1. Подготовка (приводим ID к строкам)
target_item_ids = [str(i).strip() for i in target_item_ids]


# Чистим значения в ключевых колонках
for col in ['item_id', 'item_name', 'product_name']:
    if col in df_stock.columns:
        df_stock[col] = df_stock[col].astype(str).str.strip()

# ==========================================
# 2. ПРОВЕРКА НАЙДЕННЫХ ЗНАЧЕНИЙ
# Получаем все уникальные ID из датафрейма
unique_ids_in_df = set(df_stock['item_id'].unique())

# Вычисляем разницу: чего нет в базе
missing_ids = set(target_item_ids) - unique_ids_in_df

# Выводим результаты проверки
print("=== СТАТУС ПОИСКА ===")
if missing_ids:
    print(f"⚠️ ВНИМАНИЕ! Следующие ID НЕ найдены в базе:\n   {missing_ids}")
else:
    print(f"✅ Все целевые ID ({len(target_item_ids)} шт.) успешно найдены!")
print("=====================\n")
# ==========================================

# 3. ПОИСК
# Находим маску по item_id
mask_id = df_stock['item_id'].isin(target_item_ids)

# Создаем итоговый датафрейм со всеми найденными позициями
df_matched = df_stock[mask_id].copy()

# Маркируем, как нашли
df_matched['found_via'] = "item_id"


# Фильтруем основной сток, оставляя только те ID, которые есть в нашем списке найденных
stocke_code = df_stock[df_stock['item_id'].astype(str).isin(df_matched['item_id'].unique())].copy()

print(f"\nИтого уникальных ID в финальной таблице: {stocke_code['item_id'].nunique()}")


# %%
import pandas as pd
import pyarrow.dataset as ds
import os

folder_path = '/home/usman/onedrive_folder/project_data/df_only'

# Получаем и сортируем список папок
subdirs = [os.path.join(folder_path, d) for d in os.listdir(folder_path) 
           if os.path.isdir(os.path.join(folder_path, d)) and d.startswith("date=")]
subdirs.sort()

# Берем последние 35 дней
last_35_days = subdirs[-35:]

# СОБИРАЕМ СПИСОК ФАЙЛОВ
# Проходимся по нашим 35 папкам и складываем пути до самих файлов parquet
file_paths = []
for d in last_35_days:
    for f in os.listdir(d):
        if f.endswith('.parquet'):
            file_paths.append(os.path.join(d, f))

# Передаем список ФАЙЛОВ (теперь PyArrow воспримет это так же легко, как и общую папку)
dataset = ds.dataset(file_paths, format="parquet", partitioning=None)

# Переводим в Pandas
dfps = dataset.to_table().to_pandas()

print(dfps.shape)
print(dfps.head())



# %%
# Один раз фильтруем
dfps_filtered = dfps[(dfps['status'] == 'SUCCESS') & (dfps['type'] == 'VOUCHER_SALE')]

# groupc и avg_price из одного источника
groupc = dfps_filtered.groupby(['item_id','created_at_ymd'])['qty'].sum().reset_index()
avg_price = dfps_filtered.groupby(['item_id', 'created_at_ymd'])['unitamount_usd'].mean().reset_index()

groupc_to_merge = groupc.rename(columns={'created_at_ymd': 'date', 'qty': 'Daily_Spend'})
avg_price_to_merge = avg_price.rename(columns={'created_at_ymd': 'date', 'unitamount_usd': 'Avg_UnitAmount_USD'})

# ИСПРАВЛЕНИЕ: Приводим ID к строке во всех задействованных таблицах перед слиянием
stocke_code['item_id'] = stocke_code['item_id'].astype(str).str.strip()
groupc_to_merge['item_id'] = groupc_to_merge['item_id'].astype(str).str.strip()
avg_price_to_merge['item_id'] = avg_price_to_merge['item_id'].astype(str).str.strip()

# Если у вас вдруг даты имеют разный формат (допустим, дата/время против строки), 
# то на всякий случай можно их тоже привести к единому виду (строке):
stocke_code['date'] = stocke_code['date'].astype(str)
groupc_to_merge['date'] = groupc_to_merge['date'].astype(str)
avg_price_to_merge['date'] = avg_price_to_merge['date'].astype(str)

# Удаляем колонки если уже существуют
stocke_code = stocke_code.drop(columns=['Daily_Spend', 'Avg_UnitAmount_USD'], errors='ignore')

stocke_code = stocke_code.merge(groupc_to_merge[['item_id', 'date', 'Daily_Spend']], on=['item_id', 'date'], how='left')
stocke_code = stocke_code.merge(avg_price_to_merge[['item_id', 'date', 'Avg_UnitAmount_USD']], on=['item_id', 'date'], how='left')

stocke_code['Daily_Spend'] = stocke_code['Daily_Spend'].fillna(0)
stocke_code['Avg_UnitAmount_USD'] = stocke_code['Avg_UnitAmount_USD'].fillna(0)

print(stocke_code.head())


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

# Добавили параметр target_days=5
    def calc_need_to_top_up(group, target_days=5):
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
            
            # 5. Целевой запас (Прогноз * 5 дней)
            target_stock = avg_forecast * target_days
            # 6. Вычисляем потребность (целевой запас минус то, что уже есть на складе)
            need = (target_stock - group['quantity']).clip(lower=0).round(2)
            
            return pd.DataFrame({'need': need, 'forecast': avg_forecast.round(2)})

# Применяем расчет, явно указывая, на сколько дней хотим сделать запас (target_days=5)
    calc_results = df.groupby('item_id', group_keys=False).apply(
        lambda g: calc_need_to_top_up(g, target_days=5)
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

# --- Запуск ---
full_df, summary_report = enterprise_liquidity_engine_v2(stocke_code)

# %%
from datetime import datetime
summary_report['Дата отчета'] = datetime.now().strftime('%Y-%m-%d %H:%M')
# Если нужна просто новая колонка "Дата статуса" с временем до минут:
summary_report['Дата статуса'] = datetime.now().strftime('%Y-%m-%d %H:%M')
# Статус
def assign_status(row):
    # Достаем переменные для удобства чтения
    days_left = row['Дней до нуля']
    forecast = row['Расчетный прогноз расхода']
    
    # 1. Критический остаток (хватит на 1 день или меньше)
    if days_left <= 1 and forecast > 0:
        return '🚨 Критично'
        
    # 2. Пора заказывать (хватит на 3 дня или меньше) — закладываем время на логистику/оплату
    elif days_left <= 3 and forecast > 0:
        return '⚠️ Требуется пополнение'
        
    # 3. Мертвый сток (нет в наличии и не продается)
    elif row['Выручка за 30д $'] == 0 and row['Количество (сегодня)'] == 0:
        return '💀 Мёртвый сток'
        
    # 4. Нет продаж (товар есть, но движения по нему нет)
    elif row['Выручка за 30д $'] == 0:
        return '💤 Нет продаж'
        
    # 5. Все отлично (дней до нуля > 3)
    else:
        return '✅ Достаточно'

# Применяем статусы к итоговому отчету
summary_report['Статус'] = summary_report.apply(assign_status, axis=1)
# Приводим item_id к строке, чтобы избежать конфликта типов
summary_report['item_id'] = summary_report['item_id'].astype(int)



# %%
summary_report.head()

# %%
import os
from datetime import datetime

# 1. Получаем сегодняшнюю дату в нужном формате
today_str = datetime.now().strftime('%Y-%m-%d')

# 2. Формируем путь к папке (получится 'processed/stock_code/date=2026-04-14')
folder_path = f'/home/usman/onedrive_folder/project_data/stock_code/date={today_str}'

# 3. Принудительно создаем папку. 
# exist_ok=True означает: "Не надо выдавать ошибку, если папка уже существует"
os.makedirs(folder_path, exist_ok=True)

# 4. Формируем полный путь к самому файлу. 
# Мы назовем его report.parquet (вы можете поменять название на любое)
parquet_path = f'{folder_path}/report.parquet'

# 5. Теперь сохраняем файл
summary_report.to_parquet(parquet_path, index=False)

print(f"✅ Отчет успешно сохранен по пути: {parquet_path}")


# %%
import pandas as pd
import pyarrow.dataset as ds
 
pd.options.display.float_format = '{:,.2f}'.format
pd.set_option('display.max_rows', None)
pd.set_option('display.max_columns', None)
pd.set_option('display.max_seq_items', None)

# 1. Загружаем все исторические отчеты (PyArrow автоматически прочитает вложенные папки)
folder_path = '/home/usman/onedrive_folder/project_data/stock_code'
dataset = ds.dataset(folder_path, format="parquet")
df_all = dataset.to_table().to_pandas()

# Переводим колонку в правильный формат времени для точной сортировки
df_all['Дата статуса'] = pd.to_datetime(df_all['Дата статуса'], format='ISO8601', utc=True).dt.tz_convert('Asia/Dubai').dt.tz_localize(None)

# 2. Сортируем все хронологически: по товару, а внутри — по времени сканирования
df_sorted = df_all.sort_values(by=['item_id', 'Дата статуса']).copy()

# ================================================================= #
# ‼️ ВАЖНО: Укажите точное название вашей колонки!
# (поскольку в прошлом коде мы не назвали ни одну из колонок 'Статус', 
# укажите здесь нужную: например 'Аномалия расход?' или 'Нужно долить $')
status_col = 'Статус' 
# ================================================================= #

# 3. Вычисляем "непрерывные блоки" статусов (Эпохи)
# Алгоритм построчно смотрит в прошлое и сравнивает: изменился ли статус по сравнению с прошлым сканированием?
df_sorted['is_new_status'] = df_sorted.groupby('item_id')[status_col].shift() != df_sorted[status_col]
# Каждая смена статуса увеличивает номер блока на 1
df_sorted['status_block'] = df_sorted.groupby('item_id')['is_new_status'].cumsum()

# 4. Оставляем только АКТУАЛЬНЫЕ (последние) непрерывные блоки для каждого item_id
last_blocks = df_sorted[
    df_sorted.groupby('item_id')['status_block'].transform('max') == df_sorted['status_block']
].copy()

# 5. Формируем финальную выборку (ровно такая же таблица 1 в 1)
# Берем самую последнюю (свежую) записанную строку из актуального блока
final_df = last_blocks.sort_values('Дата статуса').groupby('item_id').last().reset_index()

# 6. НАХОДИМ И ПОДМЕНЯЕМ ДАТУ
# Ищем самую РАННЮЮ дату в этом последнем неизменном блоке 
# (т.е. вычисляем точный момент времени, когда этот актуальный статус ВПЕРВЫЕ закрепился)
status_start_dates = last_blocks.groupby('item_id')['Дата статуса'].min().reset_index()

# Удаляем свежую "Дату статуса" и заменяем ее нашей расчитанной датой изменения
final_df = final_df.drop(columns=['Дата статуса']).merge(status_start_dates, on='item_id')

# Очищаем таблицу от мусора (служебных колонок)
final_df = final_df.drop(columns=['is_new_status', 'status_block'], errors='ignore')

# 7. Для удобства — сортируем таблицу по убыванию "Свежести изменений" 
# (наверху будут те item_id, у которых статус изменился совсем недавно)
final_df_report = final_df.sort_values('Дата статуса', ascending=False)

print(final_df_report.head())


# 8. Формируем путь к папке (получится 'processed/stock_code/date=2026-04-14')
folder_path = '/home/usman/onedrive_folder/project_data/stock_code'

# 9. Принудительно создаем папку. 
# exist_ok=True означает: "Не надо выдавать ошибку, если папка уже существует"
os.makedirs(folder_path, exist_ok=True)

# 10. Формируем полный путь к самому файлу. 
today_str = datetime.now().strftime('%Y-%m-%d')

parquet_path = f'{folder_path}/report_date={today_str}.parquet'

# 11. Теперь сохраняем файл
final_df_report.to_parquet(parquet_path, index=False)

print(f"✅ Отчет final_df_report успешно сохранен по пути: {parquet_path}")

# --- СИНХРОНИЗАЦИЯ С SUPABASE ---
print("🔄 Начинаем синхронизацию данных с Supabase...")
try:
    import sys
    # Жесткий путь к папке backend на сервере Ubuntu
    backend_path = "/home/usman/miniapps/backend"
    sys.path.append(backend_path)
    
    from supabase_client import SupabaseManager
    
    # Настройки Supabase
    SUPABASE_URL = "https://mmsjmkvkytiehqdvsclt.supabase.co"
    SUPABASE_KEY = "sb_publishable_yoPhk5ao0u8me4NrxxjY-w_sJTue1iS"

    db = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
    
    # Подготовка данных из final_df_report (фильтруем только нужное)
    allowed_statuses = ['🚨 Критично', '⚠️ Требуется пополнение']
    
    records = []
    for _, row in final_df_report.iterrows():
        # Добавляем только если товар реально требует закупки
        if row.get('Статус') in allowed_statuses:
            records.append({
                "id": str(int(row['item_id'])),
                "name": row['item_name'],
                "group": "Общая", # Заглушка
                "qty": float(row['Количество (сегодня)']),
                "days": float(row['Дней до нуля']),
                "need": float(row['Нужно пополнить (шт)'])
            })
            
    if not records:
        print("✅ Нет товаров с критическим статусом для синхронизации.")
    else:
        if db.sync_parquet_data(records):
            print(f"✅ Успешно синхронизировано {len(records)} товаров!")
        else:
            print("❌ Ошибка при отправке данных в Supabase.")
        
except Exception as e:
    print(f"❌ Ошибка вызова Supabase: {str(e)}")
