from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import json
from typing import Optional, List
import os
import sys

# Ensure local imports work regardless of how script is run
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import database
except ImportError:
    from . import database


app = FastAPI(title="Swiss Analytics API")

# Enable GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_filters(request_params):
    """Parses query parameters into a filters dictionary for the DB layer."""
    filters = {}
    # Columns we want to support filtering for
    filter_cols = [
        'type', 'Category', 'Currency', 'counterparty', 'Groupclient', 
        'Product country', 'CountryGroup', 'Item name', 'Product name'
    ]
    for col in filter_cols:
        val = request_params.get(col)
        if val:
            try:
                if val.startswith('['):
                    filters[col] = json.loads(val)
                else:
                    filters[col] = val.split(',')
            except:
                filters[col] = [val]
    
    # Date Filter parameters
    filters['dateMode'] = request_params.get('dateMode', 'all')
    filters['startDate'] = request_params.get('startDate')
    filters['endDate'] = request_params.get('endDate')
    filters['relativeValue'] = request_params.get('relativeValue')
    filters['relativeUnit'] = request_params.get('relativeUnit', 'day')
    
    return filters

@app.get("/api/filters/options")
def get_options(column: str, search: Optional[str] = None):
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
    top_n: int = 5, 
    interval: str = 'day',
    request: Request = None
):
    filters = parse_filters(dict(request.query_params))
    data = database.get_trends(metric, dimension, top_n, interval, filters=filters)
    if data and len(data) > 0:
        print(f"DEBUG: {interval} trend first item: {data[0]}")
    return data

@app.get("/api/distribution")
async def get_distribution(
    metric: str = 'Amount_USD', 
    dimension: str = 'Category', 
    top_n: int = 5,
    request: Request = None
):
    filters = parse_filters(dict(request.query_params))
    return database.get_distribution(metric, dimension, top_n, filters=filters)

@app.get("/api/master")
async def get_master(dimension: str = 'Category', request: Request = None):
    filters = parse_filters(dict(request.query_params))
    return database.get_master_table(dimension, filters=filters)

@app.get("/api/detail")
async def get_detail(
    dimension: str = 'Category', 
    selected_group: Optional[str] = None, 
    top_n: int = 10,
    request: Request = None
):
    filters = parse_filters(dict(request.query_params))
    return database.get_detail_table(dimension, selected_group, top_n, filters=filters)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
