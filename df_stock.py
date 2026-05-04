# %%
import pandas as pd
import numpy as np

pd.options.display.float_format = '{:,.2f}'.format
pd.set_option('display.max_rows', None)
pd.set_option('display.max_columns', None)
pd.set_option('display.max_seq_items', None)



# %%
import pandas as pd
import pyarrow.dataset as ds
from datetime import datetime, timedelta
import os

folder_path = "/home/usman/onedrive_folder/project_data/stocks"

# Вычисляем нужные даты (вчера и сегодня)
today_str = datetime.now().strftime("%Y-%m-%d")
yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

paths_to_load = []
for date_str in [yesterday_str, today_str]:
    day_folder = os.path.join(folder_path, f"date={date_str}")
    if os.path.exists(day_folder):
        # Собираем все parquet-файлы внутри папки дня
        for f in os.listdir(day_folder):
            if f.endswith('.parquet'):
                paths_to_load.append(os.path.join(day_folder, f))

if not paths_to_load:
    print(f"⚠️ Файлы за {yesterday_str} и {today_str} не найдены!")
    df_all_stocks = pd.DataFrame()
else:
    # Загружаем конкретные файлы
    dataset = ds.dataset(paths_to_load, format="parquet", partitioning="hive")
    df_all_stocks = dataset.to_table().to_pandas()

print(df_all_stocks.shape)
print(df_all_stocks.head())


# %%
import pandas as pd

# Переименовываем столбцы через словарь
df_all_stocks = df_all_stocks.rename(columns={
    "itemId": "item_id",
    "name": "item_name",
    "productType": "product_type"
})

# Выводим первые 5 строк
df_all_stocks.head(5)

# %%
import pandas as pd

# Пути к конкретным папкам (или файлам)
products_path = "/home/usman/onedrive_folder/project_data/products"
groups_path = "/home/usman/onedrive_folder/project_data/productgroups"

print("--- Загрузка таблицы Products ---")
try:
    # В Pandas читаем parquet напрямую через pd
    df_products = pd.read_parquet(products_path)
    # Вместо .count() используем len() или .shape[0]
    print(f"Успешно прочитано! Строк: {len(df_products)}")
    # head(5) — аналог limit(5)
    print(df_products.head(5)) 
except Exception as e:
    print(f"Ошибка при чтении products: {e}")

print("\n--- Загрузка таблицы Products Groups ---")
try:
    df_groups = pd.read_parquet(groups_path)
    print(f"Успешно прочитано! Строк: {df_groups.shape[0]}")
    print(df_groups.head(5))
except Exception as e:
    print(f"Ошибка при чтении productsgroups: {e}")

# %%
# --- 1. Переименование столбцов в таблице Products ---
# Теперь ключи соответствуют вашему выводу (itemId, itemName и т.д.)
products_rename_map = {
    "itemId": "item_id",
    "itemName": "item_name",
    "productId": "product_id",
    "productName": "product_name",
    "type": "product_type",      # В вашем выводе это 'type'
    "rrpCurrency": "rrp_currency",
    "inStock": "in_stock",
    "category": "category",      # Эти уже в нижнем регистре, 
    "country": "country",        # но оставим для порядка
    "rrp": "rrp"
}

df_products = df_products.rename(columns=products_rename_map)

print("--- Схема Products после исправления ---")
print(df_products.dtypes)


# --- 2. Переименование столбцов в таблице Products Groups ---
# Тут, судя по вашему выводу, всё уже сработало, но закрепим результат
groups_rename_map = {
    "groupId": "group_id",
    "itemId": "item_id",
    "itemName": "item_name",
    "productName": "product_name"
}

df_groups = df_groups.rename(columns=groups_rename_map)

print("\n--- Схема Products Groups ---")
print(df_groups.dtypes)

# %%
import pandas as pd
import yfinance as yf
from datetime import timedelta
import numpy as np

# 1. Получаем список уникальных дат
if 'date' not in df_all_stocks.columns or df_all_stocks['date'].empty:
    print("Ошибка: В DataFrame нет дат!")
else:
    # В Pandas unique() возвращает массив уникальных значений
    distinct_dates = pd.to_datetime(df_all_stocks['date'], format='ISO8601', utc=True).dt.tz_convert('Asia/Dubai').dt.tz_localize(None).dropna().unique()
    
    min_date = min(distinct_dates)
    max_date = max(distinct_dates)
    
    # Временные границы для загрузки курсов
    start_dt = min_date - timedelta(days=5)
    end_dt = max_date + timedelta(days=2)
    
    print(f"Поиск курсов для дат с {min_date.date()} по {max_date.date()}...")

    currencies = {
        'eur': 'EURUSD=X', 'aed': 'AEDUSD=X', 'inr': 'INRUSD=X',
        'try': 'TRYUSD=X', 'brl': 'BRLUSD=X', 'gbp': 'GBPUSD=X',
        'rub': 'RUBUSD=X',
    }

    # 2. Загружаем курсы
    rates_data = []
    
    for cur_name, ticker in currencies.items():
        try:
            data = yf.download(ticker, start=start_dt.strftime("%Y-%m-%d"), 
                               end=end_dt.strftime("%Y-%m-%d"), progress=False)
            
            if not data.empty:
                # Извлекаем Close. В новых версиях yf это может быть Series или DF
                close_series = data['Close']
                if isinstance(close_series, pd.DataFrame):
                    close_series = close_series.iloc[:, 0]
                
                for d in distinct_dates:
                    # ffill логика: берем последнее доступное значение до даты включительно
                    past_data = close_series.loc[:d]
                    if not past_data.empty:
                        rate = float(past_data.iloc[-1])
                        rates_data.append({'date': d, 'currency': cur_name, 'exchange_rate': rate})
        except Exception as e:
            print(f"Ошибка при загрузке {cur_name}: {e}")

    # Добавляем USD и стейблкоины
    for d in distinct_dates:
        for stable in ['usd', 'usdc', 'usdt']:
            rates_data.append({'date': d, 'currency': stable, 'exchange_rate': 1.0})

    # Создаем DataFrame с курсами
    df_rates = pd.DataFrame(rates_data)
    # Приводим даты к одному формату для корректного merge
    df_rates['date'] = pd.to_datetime(df_rates['date'])
    df_all_stocks['date'] = pd.to_datetime(df_all_stocks['date'] , format='ISO8601', utc=True).dt.tz_convert('Asia/Dubai').dt.tz_localize(None)

    # 3. Трансформация таблицы (Аналог Stack в PySpark — это Melt в Pandas)
    currency_columns = ["aed", "usd", "eur", "gbp", "brl", "tryCurrency"]
    available_currencies = [c for c in currency_columns if c in df_all_stocks.columns]

    df_long = pd.melt(
        df_all_stocks,
        id_vars=["item_id", "item_name", "product_type", "quantity", "date"],
        value_vars=available_currencies,
        var_name="currency_raw",
        value_name="amount"
    )

    # Переименовываем валюту и удаляем пустые цены
    df_long['currency'] = df_long['currency_raw'].replace('tryCurrency', 'try')
    df_long = df_long.dropna(subset=['amount'])

    # 4. Соединение с курсами и расчеты
    df_result = pd.merge(df_long, df_rates, on=['date', 'currency'], how='left')

    # Расчет USD эквивалента и цены за единицу
    df_result['amount_usd'] = df_result['amount'] * df_result['exchange_rate']
    
    # Безопасное деление через numpy (аналог F.when в Spark)
    df_result['stock_pt_mpd'] = np.where(
        df_result['quantity'] > 0, 
        df_result['amount_usd'] / df_result['quantity'], 
        0
    )

    # 5. Результат
    print("\nРезультат трансформации (первые 10 строк):")
    final_columns = [
        "date", "item_id", "item_name", "product_type", "currency", 
        "quantity", "amount", "exchange_rate", "amount_usd", "stock_pt_mpd"
    ]
    print(df_result[final_columns].head(10))

# %%
print("--- Проверка столбцов таблицы Products ---")
print(f"Всего столбцов: {len(df_products.columns)}")
print(df_products.columns.tolist())

print("\n--- Проверка столбцов таблицы Result (Stocks) ---")
print(f"Всего столбцов: {len(df_result.columns)}")
print(df_result.columns.tolist())

# Посмотрим на пару строк из Products, чтобы понять, что внутри
print("\n--- Первые 2 строки из Products ---")
print(df_products.head(2))

# %%
import pandas as pd
import numpy as np

print("--- Построение полной матрицы стоков ---")

# 1. Получаем уникальные даты и гарантируем формат datetime
df_result['date'] = pd.to_datetime(df_result['date'], format='ISO8601', utc=True).dt.tz_convert('Asia/Dubai').dt.tz_localize(None)
df_dates = pd.DataFrame(df_result['date'].unique(), columns=['date'])

# 2. Берем справочник товаров
# ИСПРАВЛЕНИЕ: приводим к snake_case (нижний регистр + замена пробелов)
df_products.columns = [c.lower().replace(' ', '_') for c in df_products.columns]

# Выбираем нужные колонки
df_catalog = (df_products[['item_id', 'item_name', 'product_type', 'product_id', 'product_name']]
              .drop_duplicates())

# 3. Строим "скелет" (Cartesian Product)
df_skeleton = df_dates.merge(df_catalog, how='cross')

# 4. Присоединяем реальные данные
# Оставляем только нужные колонки в правой части, чтобы избежать конфликтов имен
df_result_clean = df_result.drop(columns=["item_name", "product_type"], errors='ignore')

df_stocks_full = pd.merge(
    df_skeleton, 
    df_result_clean, 
    on=["date", "item_id"], 
    how="left"
)

# 5. Заполняем пропуски
fill_values = {
    "quantity": 0,
    "amount": 0,
    "amount_usd": 0,
    "stock_pt_mpd": 0,
    "exchange_rate": 0,
    "currency": "usd"
}
df_stocks_full = df_stocks_full.fillna(value=fill_values)

# --- Проверка результата ---
total_dates = len(df_dates)
total_products = len(df_catalog)
expected_rows = total_dates * total_products
actual_rows = len(df_stocks_full)

print(f"Уникальных дат: {total_dates}")
print(f"Уникальных товаров в каталоге: {total_products}")
print(f"Ожидаемое количество строк: {expected_rows}")
print(f"Итоговое количество строк: {actual_rows}")

if expected_rows == actual_rows:
    print("✅ Скелет собран идеально!")

print("\nЗаписи с нулевым остатком (пример):")
print(df_stocks_full[df_stocks_full['quantity'] == 0].head(10))

# %%
import pandas as pd

print("--- Подготовка групп и объединение ---")

# 1. Создаем group_key (префикс 'g_' + ID группы)
# В Pandas мы просто переводим ID в строку и складываем
df_groups['group_key'] = 'g_' + df_groups['group_id'].astype(str)

# 2. Выбираем нужные колонки
groups_subset = df_groups[['group_id', 'group_key', 'item_id']]

# 3. Выполняем Left Join
# Объединяем "скелет" стоков с таблицей групп по item_id
df_stock = pd.merge(df_stocks_full, groups_subset, on="item_id", how="left")

# 4. Заполняем пустые значения group_key (логика Coalesce)
# Если у товара нет группы (NaN), создаем ключ из его item_id с префиксом 'i_'
fallback_key = 'i_' + df_stock['item_id'].astype(str)
df_stock['group_key'] = df_stock['group_key'].fillna(fallback_key)

# 5. Выводим результат
final_cols_to_show = [
    "date",          
    "item_id", 
    "group_key", 
    "currency", 
    "quantity", 
    "amount", 
    "amount_usd", 
    "stock_pt_mpd"
]

print("Результат объединения с группами (первые 10 строк):")
print(df_stock[final_cols_to_show].head(10))

# %%
import pandas as pd

print("--- Групповой расчет стоков (Window Functions) ---")

# Список колонок, для которых нужно найти максимум в рамках группы
cols_to_update = ["quantity", "stock_pt_mpd", "amount_usd"]

# 1. Группируем по дате и ключу группы
# 2. Применяем transform("max"), чтобы получить максимальные значения
# 3. Перезаписываем существующие колонки
df_stock[cols_to_update] = (
    df_stock
    .groupby(["date", "group_key"])[cols_to_update]
    .transform("max")
)

# 3. Выводим результат для проверки
cols_to_show = [
    "date", 
    "item_id", 
    "group_key", 
    "quantity", 
    "currency", 
    "amount_usd"
]

print("Результат расчета максимального стока по группам (первые 10 строк):")
print(df_stock[cols_to_show].head(10))

# %%
import os
import pandas as pd

# 1. Настройка путей
# Создаем базовую папку proceed/df_stock
base_path = '/home/usman/onedrive_folder/project_data/df_stock'
os.makedirs(base_path, exist_ok=True)
# 2. Подготовка строковой даты для названий папок
# Поскольку колонка created_at_ymd уже имеет тип datetime64[s], просто форматируем её
df_stock['temp_date_folder'] = df_stock['date'].dt.strftime('%Y-%m-%d')

print(f"Начинаю сохранение {len(df_stock)} строк по дням...")

# 3. Группировка и сохранение
# Использование groupby здесь эффективно, так как он не копирует весь DF сразу
for date_val, day_df in df_stock.groupby('temp_date_folder'):
    # Создаем путь: proceed/df_stock/date=YYYY-MM-DD
    target_dir = os.path.join(base_path, f"date={date_val}")
    os.makedirs(target_dir, exist_ok=True)
    
    file_path = os.path.join(target_dir, "data.parquet")
    
    # Сохраняем день. Удаляем временную колонку перед записью
    # Используем engine='pyarrow' для скорости на больших данных
    day_df.drop(columns=['temp_date_folder']).to_parquet(
        file_path, 
        index=False, 
        engine='pyarrow', 
        compression='snappy'
    )
    
    print(f"✅ Сохранено: {date_val} | Строк: {len(day_df)}")

# Удаляем временную колонку из основного DataFrame, чтобы не занимать память
df_stock.drop(columns=['temp_date_folder'], inplace=True)

print("\n--- Все данные успешно распределены по папкам! ---")


