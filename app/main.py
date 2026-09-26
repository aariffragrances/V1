import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
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


def _html_response(filename: str, status_code: int = 200) -> Response:
    candidates = [
        FRONTEND_DIR / filename,
        Path.cwd() / "frontend" / filename,
        Path("/var/task/frontend") / filename,
    ]
    for target in candidates:
        if target.is_file():
            return FileResponse(target, status_code=status_code, headers=_HTML_HEADERS)
    fallback_404 = FRONTEND_DIR / "404.html"
    if fallback_404.is_file():
        return FileResponse(fallback_404, status_code=404, headers=_HTML_HEADERS)
    return JSONResponse(
        status_code=200,
        content={
            "service": "Aarif Fragrances API",
            "status": "online",
            "docs": "/docs",
            "health": "/health",
            "frontend": "https://aariffragnances.netlify.app",
        },
    )


async def _warmup_db() -> None:
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            # Only run heavy seeding if table is unpopulated
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
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
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


class VercelPathFixMiddleware:
    """Restores the original request path from Vercel rewrite headers (x-matched-path, x-forwarded-uri, etc.)"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path in ("/api/index.py", "api/index.py", "/api/index.py/", "/api/index") or path.endswith("/api/index.py"):
                headers = dict(scope.get("headers", []))
                matched = headers.get(b"x-matched-path", b"").decode("latin-1")
                if matched and matched not in ("/api/index.py", "api/index.py", "/api/index.py/"):
                    scope["path"] = matched
                else:
                    for h in (b"x-forwarded-uri", b"x-original-url", b"x-rewrite-url"):
                        orig = headers.get(h, b"").decode("latin-1")
                        if orig and orig not in ("/api/index.py", "api/index.py", "/api/index.py/"):
                            scope["path"] = orig
                            break
        await self.app(scope, receive, send)


app.add_middleware(VercelPathFixMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.vercel\.app|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(auth.router)
app.include_router(contact.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "aarif-fragrances"}


@app.api_route("/api/index.py", methods=["GET", "HEAD"])
@app.api_route("/api", methods=["GET", "HEAD"])
@app.api_route("/api/", methods=["GET", "HEAD"])
async def serve_api_root():
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": "Aarif Fragrances API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
        },
    )


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
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return _html_response("404.html", status_code=404)


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


for folder in ("css", "js", "assets"):
    folder_path = None
    for base in (FRONTEND_DIR, Path.cwd() / "frontend", Path("/var/task/frontend")):
        candidate = base / folder
        if candidate.is_dir():
            folder_path = candidate
            break
    if folder_path:
        app.mount(f"/{folder}", CachedStaticFiles(directory=str(folder_path)), name=folder)
        app.mount(f"/frontend/{folder}", CachedStaticFiles(directory=str(folder_path)), name=f"fe_{folder}")

try:
    PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", CachedStaticFiles(directory=str(PRODUCT_UPLOADS_DIR.parent)), name="uploads")
except OSError:
    logger.info("Read-only filesystem detected; skipping local uploads directory creation")


@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/index.html", methods=["GET", "HEAD"])
@app.api_route("/frontend", methods=["GET", "HEAD"])
@app.api_route("/frontend/", methods=["GET", "HEAD"])
async def serve_index():
    return _html_response("index.html")


@app.api_route("/admin", methods=["GET", "HEAD"])
@app.api_route("/admin.html", methods=["GET", "HEAD"])
@app.api_route("/frontend/admin", methods=["GET", "HEAD"])
@app.api_route("/frontend/admin.html", methods=["GET", "HEAD"])
async def serve_admin():
    return _html_response("admin.html")


for page in HTML_PAGES[1:]:
    def make_handler(filename: str):
        async def handler():
            return _html_response(filename)
        return handler

    app.add_api_route(f"/{page}", make_handler(page), methods=["GET", "HEAD"])
    app.add_api_route(f"/frontend/{page}", make_handler(page), methods=["GET", "HEAD"])


@app.api_route("/{page_path:path}", methods=["GET", "HEAD"])
async def spa_fallback(page_path: str):
    p_clean = page_path.strip("/")
    if p_clean in ("", "index", "index.html", "frontend", "frontend/index.html"):
        return _html_response("index.html")
    if p_clean in ("api/index.py", "api", "api/"):
        return JSONResponse(
            status_code=200,
            content={
                "status": "healthy",
                "service": "Aarif Fragrances API",
                "docs": "/docs",
                "health": "/health",
            },
        )
    if any(p_clean.startswith(prefix) for prefix in ("api/v1/", "api/auth", "api/catalog", "api/orders", "api/contact", "api/admin")):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    clean_path = p_clean[9:] if p_clean.startswith("frontend/") else p_clean
    if not clean_path or clean_path in ("index.html", "index"):
        return _html_response("index.html")
    for base in (FRONTEND_DIR, Path.cwd() / "frontend", Path("/var/task/frontend")):
        candidate = base / clean_path
        if candidate.is_file():
            if candidate.suffix.lower() == ".html":
                return FileResponse(candidate, headers=_HTML_HEADERS)
            return FileResponse(candidate)
        html_candidate = base / f"{clean_path}.html"
        if html_candidate.is_file():
            return FileResponse(html_candidate, headers=_HTML_HEADERS)
    return _html_response("404.html", status_code=404)
