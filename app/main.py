import logging
from contextlib import asynccontextmanager

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

_HTML_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


def _html_response(filename: str, status_code: int = 200) -> FileResponse:
    target = FRONTEND_DIR / filename
    if not target.is_file():
        target = FRONTEND_DIR / "404.html"
        status_code = 404
    return FileResponse(target, status_code=status_code, headers=_HTML_HEADERS)


async def _warmup_db() -> None:
    try:
        from sqlalchemy import text
        from app.core.db_setup import (
            ensure_schema,
            ensure_admin_account,
            seed_fragrance_types,
            seed_perfumes,
            seed_testimonials,
            seed_banners,
        )

        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            await ensure_schema(db)
            await ensure_admin_account(db)
            await seed_fragrance_types(db)
            await seed_perfumes(db)
            await seed_testimonials(db)
            await seed_banners(db)
        logger.info("Database ready.")
    except Exception as exc:
        logger.exception("Database warmup failed: %s", exc)
        raise


async def _warmup_cache() -> None:
    try:
        from app.routers.catalog import _load_active_perfumes, _load_fragrance_types
        async with AsyncSessionLocal() as db:
            await _load_fragrance_types(db)
            await _load_active_perfumes(db)
        logger.info("Catalog cache warmed up.")
    except Exception as exc:
        logger.warning("Cache warmup failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _warmup_db()
    await _warmup_cache()
    yield


app = FastAPI(
    title="Aarif Fragrances API",
    description="REST API for Aarif Fragrances perfume e-commerce",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            p_lower = path.lower()
            if any(p_lower.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff2", ".woff", ".ttf")):
                response.headers["Cache-Control"] = "public, max-age=604800, immutable"
            elif any(p_lower.endswith(ext) for ext in (".css", ".js")):
                response.headers["Cache-Control"] = "public, max-age=86400"
        return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(auth.router)
app.include_router(contact.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.get("/health")
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "aarif-fragrances"}


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return _html_response("404.html", status_code=404)


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


for folder in ("css", "js", "assets"):
    path = FRONTEND_DIR / folder
    if path.exists():
        app.mount(f"/{folder}", CachedStaticFiles(directory=str(path)), name=folder)

PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", CachedStaticFiles(directory=str(PRODUCT_UPLOADS_DIR.parent)), name="uploads")


@app.get("/")
async def serve_index():
    return _html_response("index.html")


@app.get("/admin")
@app.get("/admin.html")
async def serve_admin():
    return _html_response("admin.html")


for page in HTML_PAGES[1:]:
    def make_handler(filename: str):
        async def handler():
            return _html_response(filename)
        return handler

    app.get(f"/{page}")(make_handler(page))


@app.get("/{page_path:path}")
async def spa_fallback(page_path: str):
    if page_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    candidate = FRONTEND_DIR / page_path
    if candidate.is_file():
        if candidate.suffix.lower() == ".html":
            return FileResponse(candidate, headers=_HTML_HEADERS)
        return FileResponse(candidate)
    html_candidate = FRONTEND_DIR / f"{page_path}.html"
    if html_candidate.is_file():
        return FileResponse(html_candidate, headers=_HTML_HEADERS)
    return _html_response("404.html", status_code=404)
