import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.paths import FRONTEND_DIR, PRODUCT_UPLOADS_DIR
from app.routers import admin, auth, catalog, contact, orders

settings = get_settings()
logger = logging.getLogger("aarif")

HTML_PAGES = [
    "index.html",
    "products.html",
    "product.html",
    "basket.html",
    "wishlist.html",
    "about.html",
    "contact.html",
    "policies.html",
    "login.html",
    "signup.html",
    "account.html",
    "404.html",
]


async def _warmup_db() -> None:
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            has_perfumes = False
            try:
                has_perfumes = bool((await db.execute(text("SELECT 1 FROM perfumes LIMIT 1"))).scalar_one_or_none())
            except Exception:
                has_perfumes = False

            if not has_perfumes:
                from app.core.db_setup import (
                    ensure_schema,
                    ensure_admin_account,
                    seed_fragrance_types,
                    seed_perfumes,
                    seed_testimonials,
                    seed_banners,
                )
                await ensure_schema(db)
                await ensure_admin_account(db)
                await seed_fragrance_types(db)
                await seed_perfumes(db)
                await seed_testimonials(db)
                await seed_banners(db)
        logger.info("Database ready.")
    except Exception as exc:
        logger.warning("Database warmup deferred or failed: %s", exc)


async def _warmup_cache() -> None:
    try:
        from app.routers.catalog import _load_active_perfumes, _load_fragrance_types, _load_active_banners
        from app.core.site_settings import load_public_site_settings
        async with AsyncSessionLocal() as db:
            await _load_fragrance_types(db)
            await _load_active_perfumes(db)
            await _load_active_banners(db)
            await load_public_site_settings(db)
        logger.info("Catalog cache fully warmed up.")
    except Exception as exc:
        logger.warning("Cache warmup failed: %s", exc)


async def _run_startup_warmup() -> None:
    """DB + cache warmup in background without blocking server boot."""
    try:
        await _warmup_db()
        await _warmup_cache()
        logger.info("Background startup warmup complete.")
    except Exception as exc:
        logger.warning("Startup warmup error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bind and accept browsers immediately. HTML/CSS/JS do not need the DB.
    task = asyncio.create_task(_run_startup_warmup(), name="aarif-startup-warmup")
    app.state.warmup_task = task
    try:
        yield
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Aarif Fragrances API",
    description="REST API for Aarif Fragrances perfume e-commerce",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.vercel\.app|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def catalog_browser_cache(request: Request, call_next):
    """Allow Edge CDN caching of public catalog GETs — instant site loads."""
    response = await call_next(request)
    path = request.url.path
    if request.method == "GET" and (path.startswith("/api/v1/catalog/") or path in ("/api/v1/banners", "/api/v1/testimonials")):
        response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    return response


app.include_router(catalog.router)
app.include_router(auth.router)
app.include_router(contact.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.get("/health")
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "aarif-fragrances"}


@app.get("/sw.js")
async def serve_service_worker():
    sw_file = FRONTEND_DIR / "sw.js"
    if sw_file.is_file():
        return FileResponse(
            sw_file,
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache, no-store, must-revalidate"},
        )
    return JSONResponse(status_code=404, content={"detail": "Service worker not found"})


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"detail": str(exc.detail) if hasattr(exc, "detail") else "Not found"})
    fallback = FRONTEND_DIR / "404.html"
    if fallback.is_file():
        return FileResponse(fallback, status_code=404)
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


for folder in ("css", "js", "assets", "data"):
    path = FRONTEND_DIR / folder
    if path.exists():
        app.mount(f"/{folder}", StaticFiles(directory=str(path)), name=folder)

try:
    PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(PRODUCT_UPLOADS_DIR.parent)), name="uploads")
except OSError:
    logger.info("Read-only filesystem detected; skipping local uploads directory creation")


@app.get("/")
@app.get("/index.html")
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/admin")
@app.get("/admin.html")
async def serve_admin_tools():
    return FileResponse(FRONTEND_DIR / "admin.html")


for page in HTML_PAGES:
    if page in ("index.html",):
        continue
    route = f"/{page}"

    def make_handler(filename: str):
        async def handler():
            return FileResponse(FRONTEND_DIR / filename)

        return handler

    app.get(route)(make_handler(page))


@app.api_route(
    "/api/{api_path:path}",
    methods=["POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def api_unmatched(api_path: str):
    """Return 404 for unknown API mutations (avoids SPA catch-all 405)."""
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.get("/{page_path:path}", include_in_schema=False)
async def spa_fallback(page_path: str):
    if page_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    candidate = FRONTEND_DIR / page_path
    if candidate.is_file():
        return FileResponse(candidate)
    html_candidate = FRONTEND_DIR / f"{page_path}.html"
    if html_candidate.is_file():
        return FileResponse(html_candidate)
    fallback_404 = FRONTEND_DIR / "404.html"
    if fallback_404.is_file():
        return FileResponse(fallback_404, status_code=404)
    return JSONResponse(status_code=404, content={"detail": "Not found"})
