from fastapi import FastAPI, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import json
import logging
from typing import Optional, List
from enum import Enum
import os
import sys
from dotenv import load_dotenv
import asyncio

# Load environment variables from .env file
load_dotenv()

# --- Supabase Integration ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

try:
    from supabase_client import SupabaseManager
    sb_manager = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
except ImportError:
    import sys
    # Look one level up for miniapps folder
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    miniapps_path = os.path.join(base_dir, 'miniapps', 'backend')
    if miniapps_path not in sys.path:
        sys.path.append(miniapps_path)
    try:
        from supabase_client import SupabaseManager
        sb_manager = SupabaseManager(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        sb_manager = None
        logging.getLogger("giftery-api").error(f"⚠️ SupabaseManager not found: {e}")

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("giftery-api")

# Путь к модулю синхронизации
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNC_PATH = os.path.join(base_dir, "miniapps", "backend")
if SYNC_PATH not in sys.path:
    sys.path.append(SYNC_PATH)

try:
    import sync_settings
except ImportError:
    sync_settings = None
    logger.error(f"⚠️ Предупреждение: Модуль sync_settings не найден в {SYNC_PATH}")


# Ensure local imports work regardless of how script is run
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import database
    import inventory
except ImportError:
    from . import database, inventory

# --- Validation ---

ALLOWED_DIMENSIONS = {
    'type', 'Category', 'Currency', 'counterparty', 'Groupclient', 'ClientCountryGroup',
    'Product country', 'CountryGroup', 'Product name', 'Item name'
}

ALLOWED_METRICS = {'Amount_USD', 'Profit_USD', 'Qty', 'Margin_%'}
ALLOWED_INTERVALS = {'day', 'week', 'month'}


app = FastAPI(
    title="Giftery Analytics API",
    description="Real-time analytics engine for Giftery business intelligence.",
    version="2.0.0"
)

# CORS: Must be added BEFORE GZip so preflight OPTIONS requests are handled first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting up: Initializing database connection...")
    try:
        # Initial connection is now fast (no data load)
        database.get_connection()
        
        # Trigger heavy data load in background so server can start immediately
        logger.info("⏳ Starting background data load into RAM (Sales/Stock)...")
        asyncio.create_task(asyncio.to_thread(database.refresh_in_memory_data))
        
        logger.info("✅ Server online and accepting requests.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database on startup: {e}", exc_info=True)

# Enable GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# --- Global Exception Handler ---

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

# --- Authentication ---

@app.post("/api/auth/login")
async def login(request: Request):
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        admin_user = os.getenv("ADMIN_USER", "admin")
        admin_pass = os.getenv("ADMIN_PASS", "giftery123")
        
        if username == admin_user and password == admin_pass:
            # In a real app, this would be a JWT or session cookie
            return {"status": "success", "token": "authenticated_session_token_2024"}
        
        return JSONResponse(
            status_code=401, 
            content={"status": "error", "message": "Invalid username or password"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Invalid request format"}
        )


# --- Filter Parsing ---

def parse_filters(request_params):
    """Parses query parameters into a filters dictionary for the DB layer."""
    filters = {}
    for col in ALLOWED_DIMENSIONS:
        val = request_params.get(col)
        if val:
            try:
                if val.startswith('['):
                    filters[col] = json.loads(val)
                else:
                    filters[col] = val.split(',')
            except (json.JSONDecodeError, AttributeError):
                logger.warning(f"Failed to parse filter for column '{col}': {val}")
                filters[col] = [val]
    
    # Date Filter parameters
    filters['dateMode'] = request_params.get('dateMode', 'all')
    filters['startDate'] = request_params.get('startDate')
    filters['endDate'] = request_params.get('endDate')
    filters['relativeValue'] = request_params.get('relativeValue')
    filters['relativeUnit'] = request_params.get('relativeUnit', 'day')
    filters['groupByClient'] = request_params.get('groupByClient') == 'true'
    
    # Status filter
    status = request_params.get('status')
    if status:
        try:
            if status.startswith('['):
                filters['status'] = json.loads(status)
            else:
                filters['status'] = [status]
        except (json.JSONDecodeError, AttributeError):
            filters['status'] = [status]
            
    return filters


# --- Endpoints ---

@app.get("/api/filters/options")
def get_options(column: str, search: Optional[str] = None, source: str = 'sales'):
    if column not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid column: {column}"})
    return {"options": database.get_filter_options(column, search=search, table_name=source)}

@app.get("/api/filters/date-range")
def get_date_range(source: str = 'sales'):
    return database.get_overall_date_range(table_name=source)

@app.get("/api/kpi")
async def get_kpi(request: Request, source: str = 'sales'):
    filters = parse_filters(dict(request.query_params))
    return database.get_kpi_data(filters=filters, table_name=source)

@app.get("/api/trends")
async def get_trends(
    metric: str = 'Amount_USD', 
    dimension: str = 'Category', 
    top_n: int = Query(default=5, ge=1, le=100), 
    interval: str = 'day',
    source: str = 'sales',
    request: Request = None
):
    if metric not in ALLOWED_METRICS:
        return JSONResponse(status_code=400, content={"error": f"Invalid metric: {metric}"})
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    if interval not in ALLOWED_INTERVALS:
        return JSONResponse(status_code=400, content={"error": f"Invalid interval: {interval}"})
    
    filters = parse_filters(dict(request.query_params))
    data = database.get_trends(metric, dimension, top_n, interval, filters=filters, table_name=source)
    logger.debug(f"Trends [{interval}] for {source}: {len(data)} rows returned")
    return data

@app.get("/api/distribution")
async def get_distribution(
    metric: str = 'Amount_USD', 
    dimension: str = 'Category', 
    top_n: int = Query(default=5, ge=1, le=100),
    source: str = 'sales',
    request: Request = None
):
    if metric not in ALLOWED_METRICS:
        return JSONResponse(status_code=400, content={"error": f"Invalid metric: {metric}"})
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    
    filters = parse_filters(dict(request.query_params))
    return database.get_distribution(metric, dimension, top_n, filters=filters, table_name=source)

@app.get("/api/master")
async def get_master(dimension: str = 'Category', source: str = 'sales', request: Request = None):
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    filters = parse_filters(dict(request.query_params))
    return database.get_master_table(dimension, filters=filters, table_name=source)

@app.get("/api/detail")
async def get_detail(
    dimension: str = 'Category', 
    selected_group: Optional[str] = None, 
    top_n: int = Query(default=10, ge=1, le=5000),
    source: str = 'sales',
    request: Request = None
):
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    filters = parse_filters(dict(request.query_params))
    return database.get_detail_table(dimension, selected_group, top_n, filters=filters, table_name=source)


# --- Group Management ---

@app.get("/api/groups/counterparties")
def get_group_counterparties(source: str = 'sales'):
    """Returns unique counterparties for group creation."""
    return {"counterparties": database.get_unique_counterparties(table_name=source)}

@app.get("/api/groups/countries")
def get_group_countries(source: str = 'sales'):
    """Returns unique countries for group creation."""
    return {"countries": database.get_unique_countries(table_name=source)}

@app.get("/api/groups/client_countries")
def get_group_client_countries(source: str = 'sales'):
    """Returns unique counterparties for client country group creation."""
    return {"client_countries": database.get_unique_counterparties(table_name=source)}

@app.get("/api/groups")
def get_groups():
    """Returns all custom groups."""
    return database.load_groups()

@app.post("/api/groups")
async def save_group(request: Request, group_type: str = Query(default='counterparties')):
    """Saves a custom group mapping."""
    try:
        body = await request.json()
        name = body.get("name")
        items = body.get("items") # Renamed from counterparties to be generic
        if not name or not items:
            return JSONResponse(status_code=400, content={"error": "Missing name or items"})
        
        data = database.load_groups()
        if group_type not in data:
            data[group_type] = {}
            
        data[group_type][name] = items
        if database.save_groups(data):
            return {"status": "ok"}
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to save groups"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.delete("/api/groups/{name}")
def delete_group(name: str, group_type: str = Query(default='counterparties')):
    """Deletes a custom group."""
    data = database.load_groups()
    if group_type in data and name in data[group_type]:
        del data[group_type][name]
        if database.save_groups(data):
            return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Group not found"})
    
@app.get("/api/catalog-search")
def search_catalog(q: str = Query(..., min_length=1)):
    """Searches products in the external parquet file."""
    try:
        import pandas as pd
        path = "/home/usman/onedrive_folder/project_data/df_product/data.parquet"
        if not os.path.exists(path):
            logger.warning(f"Catalog file not found at {path}")
            return {"results": []}
        
        df = pd.read_parquet(path)
        # Search in item_name or item_id
        search_q = q.lower()
        mask = (df['item_name'].str.lower().str.contains(search_q, na=False)) | \
               (df['item_id'].astype(str).str.contains(search_q, na=False))
        
        results = df[mask].head(15).to_dict('records')
        # Map item_name -> name, item_id -> sku_id for frontend compatibility
        mapped = [{"sku_id": str(r['item_id']), "name": r['item_name']} for r in results]
        return {"results": mapped}
    except Exception as e:
        logger.error(f"Catalog search error: {e}")
        return {"results": [], "error": str(e)}
    
# --- Stock Settings Management ---

@app.get("/api/stock/items")
def get_stock_items():
    """Returns unique items for stock monitoring."""
    return {"items": database.get_unique_items()}

@app.get("/api/stock/settings")
def get_stock_settings():
    """Returns all stock settings."""
    return database.load_stock_settings()

@app.post("/api/stock/settings")
async def save_stock_setting(request: Request, category: str = Query(default='monitored_skus')):
    """Saves a stock setting entry."""
    try:
        body = await request.json()
        item = body.get("item") # This could be an SKU object {id, name} or User object {id, name}
        if not item:
            return JSONResponse(status_code=400, content={"error": "Missing item data"})
        
        data = database.load_stock_settings()
        if category not in data:
            data[category] = []
            
        # If item already exists (by id), update it, otherwise add
        item_id = str(item.get("id"))
        found = False
        for i, existing in enumerate(data[category]):
            if str(existing.get("id")) == item_id:
                data[category][i] = item
                found = True
                break
        
        if not found:
            data[category].append(item)
            
        if database.save_stock_settings(data):
            if sync_settings:
                try: sync_settings.sync()
                except: pass
            return {"status": "ok"}
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to save settings"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.delete("/api/stock/settings/{item_id}")
def delete_stock_setting(item_id: str, category: str = Query(default='monitored_skus')):
    """Deletes a stock setting entry."""
    data = database.load_stock_settings()
    if category in data:
        data[category] = [i for i in data[category] if str(i.get("id")) != item_id]
        if database.save_stock_settings(data):
            if sync_settings:
                try: sync_settings.sync()
                except: pass
            return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Item not found"})


@app.post("/api/stock/settings/bulk")
async def save_stock_settings_bulk(request: Request, category: str = Query(default='monitored_skus')):
    """Saves multiple stock setting entries at once."""
    try:
        body = await request.json()
        items = body.get("items") # List of SKU objects [{id, name, group}, ...]
        if not items or not isinstance(items, list):
            return JSONResponse(status_code=400, content={"error": "Missing or invalid items list"})
        
        data = database.load_stock_settings()
        if category not in data:
            data[category] = []
            
        # Create a map for quick lookup
        existing_map = {str(item.get("id")): i for i, item in enumerate(data[category])}
        
        for new_item in items:
            item_id = str(new_item.get("id"))
            if item_id in existing_map:
                data[category][existing_map[item_id]] = new_item
            else:
                data[category].append(new_item)
                # Update map in case there are duplicates in the 'items' list itself
                existing_map[item_id] = len(data[category]) - 1
            
        if database.save_stock_settings(data):
            # Принудительная синхронизация с Supabase
            if sync_settings:
                try:
                    sync_settings.sync()
                except Exception as sync_err:
                    logger.error(f"Sync error: {sync_err}")
            return {"status": "ok", "count": len(items)}
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to save settings"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


# --- Health Check ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}

@app.get("/api/refresh")
def refresh_data(background_tasks: BackgroundTasks):
    """Hot-reloads the in-memory data tables from disk in the background."""
    try:
        background_tasks.add_task(database.refresh_in_memory_data)
        return {"status": "accepted", "message": "Data reload started in background"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/ai/analyze")
async def analyze_data(
    start_a: str, end_a: str, 
    start_b: str, end_b: str,
    source: str = 'sales'
):
    """
    Returns mathematical payload for data-driven analysis and syncs it to Supabase.
    """
    try:
        # Get raw math data from database
        payload = database.get_period_ai_payload(start_a, end_a, start_b, end_b, table_name=source)
        if "error" in payload:
            return JSONResponse(status_code=400, content=payload)

        # Sync to Supabase for Daily Report access
        try:
            if sb_manager:
                sb_manager.upsert_analytical_report("daily_analytics", payload)
        except Exception as sb_err:
            logger.error(f"Failed to sync report to Supabase: {sb_err}")

        return {
            "payload": payload,
            "ai_summary": None,
            "status": "complete"
        }
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return JSONResponse(
            status_code=500, 
            content={"error": str(e)}
        )


@app.get("/api/inventory/turnover")
async def get_turnover(request: Request):
    """
    Returns inventory turnover analytics for all products.
    """
    try:
        filters = parse_filters(dict(request.query_params))
        return inventory.get_inventory_turnover(filters=filters)
    except Exception as e:
        logger.error(f"Turnover calculation failed: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
