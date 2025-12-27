"""
Option Scanner API - Refactored Backend
A modular FastAPI server for options analysis and paper trading
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection - optional for Docker deployment
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'options_scanner')

if mongo_url:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
else:
    client = None
    db = None

# Create FastAPI app
app = FastAPI(
    title="Option Scanner API",
    description="API for options analysis, strategy scanning, and paper trading",
    version="2.0.0"
)

# Import route modules
from routes.quotes import router as quotes_router, set_database as set_quotes_db
from routes.options import router as options_router
from routes.strategies import router as strategies_router
from routes.portfolio import router as portfolio_router, set_database as set_portfolio_db

# Inject database into routes that need it
if db is not None:
    set_quotes_db(db)
    set_portfolio_db(db)

# Register all routers with /api prefix
app.include_router(quotes_router, prefix="/api", tags=["quotes"])
app.include_router(options_router, prefix="/api", tags=["options"])
app.include_router(strategies_router, prefix="/api", tags=["strategies"])
app.include_router(portfolio_router, prefix="/api", tags=["portfolio"])

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shutdown event
@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

# Serve React static files in production (Docker)
FRONTEND_BUILD_DIR = ROOT_DIR.parent / "frontend" / "build"
FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"

if FRONTEND_BUILD_DIR.exists() and FRONTEND_STATIC_DIR.exists():
    # Serve static files (JS, CSS, images)
    app.mount("/static", StaticFiles(directory=str(FRONTEND_STATIC_DIR)), name="static")
    
    # Serve React app for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        from fastapi import HTTPException
        # If path starts with 'api', let it pass through to API routes
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Check if it's a static file request
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        # Return index.html for all other routes (SPA routing)
        return FileResponse(str(FRONTEND_BUILD_DIR / "index.html"))
