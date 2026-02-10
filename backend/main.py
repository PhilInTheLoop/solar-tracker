import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from pathlib import Path

from .routes.readings import router as readings_router
from .routes.settings import router as settings_router
from .routes.reference import router as reference_router
from .routes.auth import router as auth_router

app = FastAPI(
    title="Solar Tracker",
    description="Track your solar panel yield and compare with reference data",
    version="1.0.0"
)


# Auth middleware - protects all /api/* routes except login and health
class AuthMiddleware(BaseHTTPMiddleware):
    OPEN_PATHS = {"/api/auth/login", "/api/health"}

    async def dispatch(self, request, call_next):
        path = request.url.path

        # Skip CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip non-API routes (frontend, static files)
        if not path.startswith("/api/"):
            return await call_next(request)

        # Skip open endpoints
        if path in self.OPEN_PATHS:
            return await call_next(request)

        # Check authorization header
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Nicht angemeldet"}
            )

        token = auth_header[7:]
        from .routes.auth import verify_session
        if not verify_session(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Sitzung abgelaufen"}
            )

        return await call_next(request)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth (added after CORS so CORS headers are set even on 401 responses)
app.add_middleware(AuthMiddleware)

# Include API routes
app.include_router(auth_router)
app.include_router(readings_router)
app.include_router(settings_router)
app.include_router(reference_router)

# Serve frontend static files
frontend_path = Path(__file__).parent.parent / "frontend"

if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(frontend_path / "index.html")

    @app.get("/manifest.json")
    async def serve_manifest():
        return FileResponse(frontend_path / "manifest.json")

    @app.get("/sw.js")
    async def serve_sw():
        return FileResponse(frontend_path / "sw.js", media_type="application/javascript")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": "Solar Tracker"}
