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

# Enable GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS: Restrict to known origins in production
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


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
    top_n: int = Query(default=10, ge=1, le=500),
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

@app.get("/api/groups")
def get_groups():
    """Returns all custom groups."""
    return database.load_groups()

@app.post("/api/groups")
async def save_group(request: Request):
    """Saves a custom group mapping."""
    try:
        body = await request.json()
        # Expecting { "group_name": "...", "counterparties": [...] }
        name = body.get("name")
        cps = body.get("counterparties")
        if not name or not cps:
            return JSONResponse(status_code=400, content={"error": "Missing name or counterparties"})
        
        current_groups = database.load_groups()
        current_groups[name] = cps
        if database.save_groups(current_groups):
            return {"status": "ok"}
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to save groups"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.delete("/api/groups/{name}")
def delete_group(name: str):
    """Deletes a custom group."""
    current_groups = database.load_groups()
    if name in current_groups:
        del current_groups[name]
        if database.save_groups(current_groups):
            return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Group not found"})


# --- Health Check ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
