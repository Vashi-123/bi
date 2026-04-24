from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import json
import logging
from typing import Optional, List
from enum import Enum
import os
import sys

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("giftery-api")

# Ensure local imports work regardless of how script is run
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import database
except ImportError:
    from . import database

# --- Validation ---

ALLOWED_DIMENSIONS = {
    'type', 'Category', 'Currency', 'counterparty', 'Groupclient',
    'Product country', 'CountryGroup', 'Item name', 'Product name'
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
def get_options(column: str, search: Optional[str] = None):
    if column not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid column: {column}"})
    return {"options": database.get_filter_options(column, search=search)}

@app.get("/api/filters/date-range")
def get_date_range():
    return database.get_overall_date_range()

@app.get("/api/kpi")
async def get_kpi(request: Request):
    filters = parse_filters(dict(request.query_params))
    return database.get_kpi_data(filters=filters)

@app.get("/api/trends")
async def get_trends(
    metric: str = 'Amount_USD', 
    dimension: str = 'Category', 
    top_n: int = Query(default=5, ge=1, le=100), 
    interval: str = 'day',
    request: Request = None
):
    if metric not in ALLOWED_METRICS:
        return JSONResponse(status_code=400, content={"error": f"Invalid metric: {metric}"})
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    if interval not in ALLOWED_INTERVALS:
        return JSONResponse(status_code=400, content={"error": f"Invalid interval: {interval}"})
    
    filters = parse_filters(dict(request.query_params))
    data = database.get_trends(metric, dimension, top_n, interval, filters=filters)
    logger.debug(f"Trends [{interval}]: {len(data)} rows returned")
    return data

@app.get("/api/distribution")
async def get_distribution(
    metric: str = 'Amount_USD', 
    dimension: str = 'Category', 
    top_n: int = Query(default=5, ge=1, le=100),
    request: Request = None
):
    if metric not in ALLOWED_METRICS:
        return JSONResponse(status_code=400, content={"error": f"Invalid metric: {metric}"})
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    
    filters = parse_filters(dict(request.query_params))
    return database.get_distribution(metric, dimension, top_n, filters=filters)

@app.get("/api/master")
async def get_master(dimension: str = 'Category', request: Request = None):
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    filters = parse_filters(dict(request.query_params))
    return database.get_master_table(dimension, filters=filters)

@app.get("/api/detail")
async def get_detail(
    dimension: str = 'Category', 
    selected_group: Optional[str] = None, 
    top_n: int = Query(default=10, ge=1, le=5000),
    request: Request = None
):
    if dimension not in ALLOWED_DIMENSIONS:
        return JSONResponse(status_code=400, content={"error": f"Invalid dimension: {dimension}"})
    filters = parse_filters(dict(request.query_params))
    return database.get_detail_table(dimension, selected_group, top_n, filters=filters)


# --- Group Management ---

@app.get("/api/groups/counterparties")
def get_group_counterparties():
    """Returns unique counterparties for group creation."""
    return {"counterparties": database.get_unique_counterparties()}

@app.get("/api/groups/countries")
def get_group_countries():
    """Returns unique countries for group creation."""
    return {"countries": database.get_unique_countries()}

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
            return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Item not found"})


# --- Health Check ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
