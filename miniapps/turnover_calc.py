import pandas as pd
import numpy as np
import os
import sys
import pyarrow.dataset as ds
from datetime import datetime

# --- CONFIGURATION ---
# Paths (Adjust these if running locally vs server)
# On server: 
# FOLDER_PATH_STOCK = '/home/usman/onedrive_folder/project_data/df_stock/'
# FOLDER_PATH_ONLY = '/home/usman/onedrive_folder/project_data/df_only'
# For the purpose of this script, we'll keep the server paths as defaults
FOLDER_PATH_STOCK = os.getenv("STOCK_DATA_PATH", '/home/usman/onedrive_folder/project_data/df_stock/')
FOLDER_PATH_ONLY = os.getenv("SALES_DATA_PATH", '/home/usman/onedrive_folder/project_data/df_only')
OUTPUT_FOLDER = os.getenv("OUTPUT_PATH", '/home/usman/onedrive_folder/project_data/turnover_reports/')

def load_data(days=30):
    """Loads stock and sales data for the last N days."""
    print(f"📂 Loading data for the last {days} days...")
    
    # 1. Load Stock Data
    subdirs_stock = sorted([
        d for d in os.listdir(FOLDER_PATH_STOCK)
        if os.path.isdir(os.path.join(FOLDER_PATH_STOCK, d)) and d.startswith("date=")
    ])[-days:]

    file_paths_stock = []
    for d in subdirs_stock:
        day_folder = os.path.join(FOLDER_PATH_STOCK, d)
        for f in os.listdir(day_folder):
            if f.endswith('.parquet'):
                file_paths_stock.append(os.path.join(day_folder, f))

    dataset_stock = ds.dataset(file_paths_stock, format="parquet", partitioning=None)
    df_stock = dataset_stock.to_table().to_pandas()
    
    # 2. Load Sales Data
    subdirs_only = sorted([
        os.path.join(FOLDER_PATH_ONLY, d) for d in os.listdir(FOLDER_PATH_ONLY) 
        if os.path.isdir(os.path.join(FOLDER_PATH_ONLY, d)) and d.startswith("date=")
    ])[-days:]

    file_paths_only = []
    for d in subdirs_only:
        for f in os.listdir(d):
            if f.endswith('.parquet'):
                file_paths_only.append(os.path.join(d, f))

    dataset_only = ds.dataset(file_paths_only, format="parquet", partitioning=None)
    df_sales = dataset_only.to_table().to_pandas()
    
    return df_stock, df_sales

def normalize_data(df_stock, df_sales):
    """Cleans and prepares data for merging."""
    print("🧹 Normalizing data...")
    
    # Clean Stock
    df_stock['item_id'] = df_stock['item_id'].astype(str).str.strip()
    df_stock['date'] = pd.to_datetime(df_stock['date']).dt.strftime('%Y-%m-%d')
    
    # Clean Sales
    df_sales_filtered = df_sales[(df_sales['status'] == 'SUCCESS') & (df_sales['type'] == 'VOUCHER_SALE')].copy()
    df_sales_filtered['item_id'] = df_sales_filtered['item_id'].astype(str).str.strip()
    df_sales_filtered['date'] = pd.to_datetime(df_sales_filtered['created_at_ymd']).dt.strftime('%Y-%m-%d')
    
    # Group sales by item and date
    sales_daily = df_sales_filtered.groupby(['item_id', 'date'])['qty'].sum().reset_index()
    sales_daily = sales_daily.rename(columns={'qty': 'daily_sales'})
    
    # Merge sales into stock
    df = df_stock.merge(sales_daily, on=['item_id', 'date'], how='left')
    df['daily_sales'] = df['daily_sales'].fillna(0)
    
    return df

def calculate_turnover(df, period_days=30):
    """
    Calculates Inventory Turnover metrics per item.
    
    Metrics:
    - Avg_Inventory: Mean stock level during the period.
    - Total_Sales: Sum of sales during the period.
    - Turnover_Ratio: Total_Sales / Avg_Inventory (How many times stock was replaced).
    - Turnover_Days: period_days / Turnover_Ratio (Average days to sell out the avg inventory).
    """
    print(f"📊 Calculating turnover metrics for {period_days} days...")
    
    # Group by item
    # Determine columns to keep (if they exist in the dataframe)
    agg_dict = {
        'item_name': 'first',
        'product_name': 'first',
        'quantity': 'median',    # Median stock (more robust to outliers than mean)
        'daily_sales': 'sum'     # Total sales in period
    }
    
    # Add stock value if available
    if 'amount_usd' in df.columns:
        agg_dict['amount_usd'] = 'median'
    
    # Add optional filter columns
    for col in ['category', 'Category', 'country', 'Country', 'counterparty', 'Groupclient']:
        if col in df.columns:
            agg_dict[col] = 'first'

    stats = df.groupby('item_id').agg(agg_dict).reset_index()
    
    # Rename for consistency
    stats = stats.rename(columns={
        'quantity': 'avg_inventory',
        'daily_sales': 'total_sales',
        'amount_usd': 'avg_stock_value_usd'
    })
    
    # Calculate Ratios
    # Turnover Ratio = Total Sales / Average Inventory
    stats['turnover_ratio'] = stats['total_sales'] / stats['avg_inventory'].replace(0, np.nan)
    
    # Turnover in Days = (Avg Inventory / Total Sales) * Period
    stats['turnover_days'] = (stats['avg_inventory'] / stats['total_sales'].replace(0, np.nan)) * period_days
    
    # Handle NaNs
    stats['turnover_ratio'] = stats['turnover_ratio'].fillna(0)
    stats['turnover_days'] = stats['turnover_days'].fillna(999).replace([np.inf, -np.inf], 999).round(1)
    
    # Add current status (latest quantity AND latest value)
    # item_id is the index, so we don't include it in selection to avoid collision on reset_index
    cols_to_select = ['quantity']
    if 'amount_usd' in df.columns: cols_to_select.append('amount_usd')
    
    latest_data = df.sort_values('date').groupby('item_id')[cols_to_select].last().reset_index()
    
    rename_map = {'quantity': 'current_stock'}
    if 'amount_usd' in df.columns: rename_map['amount_usd'] = 'current_stock_usd'
    
    latest_data = latest_data.rename(columns=rename_map)
    
    stats = stats.merge(latest_data, on='item_id', how='left')
    
    return stats

def main():
    try:
        # 1. Load
        df_stock, df_sales = load_data(days=35) # Take a bit more than 30 for stability
        
        # 2. Normalize & Merge
        df_merged = normalize_data(df_stock, df_sales)
        
        # 3. Calculate
        turnover_report = calculate_turnover(df_merged, period_days=30)
        
        # 4. Sort and Display
        turnover_report = turnover_report.sort_values('total_sales', ascending=False)
        
        print("\n🏆 Top 10 Items by Turnover Ratio (Fastest Moving):")
        print(turnover_report[turnover_report['total_sales'] > 0].sort_values('turnover_ratio', ascending=False).head(10))
        
        # 5. Save
        today_str = datetime.now().strftime('%Y-%m-%d')
        os.makedirs(OUTPUT_FOLDER, exist_ok=True)
        save_path = os.path.join(OUTPUT_FOLDER, f'inventory_turnover_{today_str}.parquet')
        
        # Local fallback if server path doesn't exist
        try:
            turnover_report.to_parquet(save_path, index=False)
            print(f"\n✅ Report saved to: {save_path}")
        except Exception as e:
            local_path = f'inventory_turnover_{today_str}.parquet'
            turnover_report.to_parquet(local_path, index=False)
            print(f"\n⚠️ Could not save to server path. Saved locally to: {local_path}")
            
    except Exception as e:
        print(f"❌ Error during calculation: {e}")

if __name__ == "__main__":
    main()
