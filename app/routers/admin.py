"""Admin API for Aarif Fragrances."""

import re
import uuid
from pathlib import Path
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.auth import require_admin
from app.core.catalog import (
    admin_cache_get,
    admin_cache_set,
    invalidate_catalog_cache,
    perfume_to_dict,
    primary_image_url,
)
from app.core.cloudinary_storage import delete_by_url, upload_upload_file
from app.database import get_db
from app.models import (
    FragranceType,
    Perfume,
    PerfumeImage,
    SiteBanner,
    SiteSetting,
    Testimonial,
    User,
    ContactSubmission,
    Order,
    OrderItem,
)
from app.schemas import (
    AdminStatsOut,
    AdminFragranceTypeIn,
    AdminPerfumeIn,
    AdminPerfumeImageIn,
    AdminBannerIn,
    AdminTestimonialIn,
    AdminSiteSettingsIn,
)
from app.paths import PRODUCT_UPLOADS_DIR, BANNER_UPLOADS_DIR

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
settings = get_settings()

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _slug(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[\s_]+", "-", s) or "item"


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsOut)
async def admin_stats(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    cached = admin_cache_get("stats")
    if cached is not None:
        return cached
    row = (await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM perfumes WHERE is_active) AS total_perfumes,
            (SELECT COUNT(*) FROM fragrance_types WHERE is_active) AS total_types,
            (SELECT COUNT(*) FROM perfumes WHERE is_active AND is_featured) AS featured_count,
            (SELECT COUNT(*) FROM perfumes WHERE is_active AND is_best_seller) AS best_seller_count,
            (SELECT COUNT(*) FROM perfumes WHERE is_active AND stock_quantity <= 10) AS low_stock_count,
            (SELECT COUNT(*) FROM orders WHERE status = 'new') AS new_orders_count
    """))).fetchone()
    result = AdminStatsOut(
        total_perfumes=row.total_perfumes,
        total_fragrance_types=row.total_types,
        featured_count=row.featured_count,
        best_seller_count=row.best_seller_count,
        low_stock_count=row.low_stock_count or 0,
        new_orders_count=row.new_orders_count or 0,
    )
    admin_cache_set("stats", result)
    return result


# ── Fragrance Types ────────────────────────────────────────────────────────────

@router.get("/fragrance-types")
async def admin_fragrance_types(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    cached = admin_cache_get("fragrance_types")
    if cached is not None:
        return cached
    result = await db.execute(text("""
        SELECT ft.type_id, ft.type_name, ft.description, ft.slug,
               ft.icon_image_url, ft.is_active, ft.display_order,
               COUNT(p.perfume_id) AS item_count
        FROM fragrance_types ft
        LEFT JOIN perfumes p ON p.fragrance_type_id = ft.type_id
        GROUP BY ft.type_id, ft.type_name, ft.description, ft.slug,
                 ft.icon_image_url, ft.is_active, ft.display_order
        ORDER BY ft.display_order, ft.type_name
    """))
    rows = [
        {
            "type_id": r.type_id, "type_name": r.type_name,
            "description": r.description, "slug": r.slug,
            "icon_image_url": r.icon_image_url, "is_active": r.is_active,
            "display_order": r.display_order, "item_count": r.item_count,
        }
        for r in result.fetchall()
    ]
    admin_cache_set("fragrance_types", rows)
    return rows


@router.post("/fragrance-types")
async def create_fragrance_type(
    body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    type_id = body.get("type_id")
    name = body.get("type_name")
    if not type_id or not name:
        raise HTTPException(status_code=422, detail="type_id and type_name required")
    db.add(FragranceType(
        type_id=type_id, type_name=name,
        description=body.get("description"),
        slug=body.get("slug") or _slug(name),
        display_order=body.get("display_order", 0),
    ))
    invalidate_catalog_cache()
    return {"ok": True, "type_id": type_id}


@router.put("/fragrance-types/{type_id}")
async def update_fragrance_type(
    type_id: str, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(FragranceType).where(FragranceType.type_id == type_id))
    ft = result.scalar_one_or_none()
    if not ft:
        raise HTTPException(status_code=404, detail="Fragrance type not found")
    for k in ("type_name", "description", "slug", "icon_image_url", "display_order", "is_active"):
        if k in body:
            setattr(ft, k, body[k])
    invalidate_catalog_cache()
    return {"ok": True}


@router.delete("/fragrance-types/{type_id}")
async def delete_fragrance_type(
    type_id: str, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(FragranceType).where(FragranceType.type_id == type_id))
    ft = result.scalar_one_or_none()
    if not ft:
        raise HTTPException(status_code=404, detail="Fragrance type not found")
    ft.is_active = False
    invalidate_catalog_cache()
    return {"ok": True}


# ── Perfumes ──────────────────────────────────────────────────────────────────

async def _get_perfume_or_404(db: AsyncSession, perfume_id: str) -> Perfume:
    result = await db.execute(
        select(Perfume)
        .options(selectinload(Perfume.images), selectinload(Perfume.fragrance_type))
        .where(Perfume.perfume_id == perfume_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Perfume not found")
    return p


@router.get("/perfumes")
async def admin_perfumes(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=500),
    fragrance_type_id: str | None = None,
    search: str | None = None,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    where = ["1=1"]
    params: dict = {"offset": (page - 1) * per_page, "limit": per_page}
    if fragrance_type_id:
        where.append("p.fragrance_type_id = :ftype_id")
        params["ftype_id"] = fragrance_type_id
    if search:
        where.append("p.perfume_name ILIKE :search")
        params["search"] = f"%{search.strip()}%"
    where_sql = " AND ".join(where)

    total = (await db.execute(text(f"SELECT COUNT(*) FROM perfumes p WHERE {where_sql}"), params)).scalar_one()
    rows = (await db.execute(text(f"""
        SELECT p.perfume_id, p.perfume_name, p.fragrance_type_id, ft.type_name,
               p.brand, p.price_6ml, p.price_12ml, p.price_30ml, p.price_50ml,
               p.is_attar, p.is_perfume, p.is_car_hanger, p.is_featured, p.is_best_seller, p.is_new_arrival,
               p.is_active, p.stock_quantity,
               pi.image_url AS primary_image_url
        FROM perfumes p
        JOIN fragrance_types ft ON ft.type_id = p.fragrance_type_id
        LEFT JOIN LATERAL (
            SELECT image_url FROM perfume_images
            WHERE perfume_id = p.perfume_id
            ORDER BY is_primary DESC, display_order ASC, id ASC LIMIT 1
        ) pi ON true
        WHERE {where_sql}
        ORDER BY ft.display_order, p.perfume_name
        OFFSET :offset LIMIT :limit
    """), params)).fetchall()

    items = [
        {
            "perfumeId": r.perfume_id, "perfumeName": r.perfume_name,
            "fragranceTypeId": r.fragrance_type_id, "fragranceTypeName": r.type_name or "",
            "brand": r.brand or "",
            "price6ml": float(r.price_6ml) if r.price_6ml else None,
            "price12ml": float(r.price_12ml) if r.price_12ml else None,
            "price30ml": float(r.price_30ml) if r.price_30ml else None,
            "price50ml": float(r.price_50ml) if r.price_50ml else None,
            "isAttar": bool(r.is_attar),
            "isPerfume": bool(r.is_perfume),
            "isCarHanger": bool(r.is_car_hanger),
            "isFeatured": bool(r.is_featured),
            "isBestSeller": bool(r.is_best_seller),
            "isNewArrival": bool(r.is_new_arrival),
            "isActive": bool(r.is_active),
            "stockQuantity": r.stock_quantity,
            "primaryImageUrl": r.primary_image_url,
        }
        for r in rows
    ]
    return {
        "items": items,
        "total_count": total,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "current_page": page,
        "per_page": per_page,
    }


@router.get("/perfumes/{perfume_id}")
async def get_admin_perfume(perfume_id: str, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    p = await _get_perfume_or_404(db, perfume_id)
    return perfume_to_dict(p, primary_image_url(p))


@router.post("/perfumes")
async def create_perfume(body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    pid = body.get("perfume_id")
    if not pid:
        raise HTTPException(status_code=422, detail="perfume_id required")
    name = body.get("perfume_name", "")
    p = Perfume(
        perfume_id=pid,
        fragrance_type_id=body["fragrance_type_id"],
        perfume_name=name,
        brand=body.get("brand"),
        slug=_slug(f"{pid}-{name}"),
        description=body.get("description"),
        price_6ml=Decimal(str(body["price_6ml"])) if body.get("price_6ml") else None,
        price_12ml=Decimal(str(body["price_12ml"])) if body.get("price_12ml") else None,
        price_30ml=Decimal(str(body["price_30ml"])) if body.get("price_30ml") else None,
        price_50ml=Decimal(str(body["price_50ml"])) if body.get("price_50ml") else None,
        is_attar=bool(body.get("is_attar", False)),
        is_perfume=bool(body.get("is_perfume", body.get("perfume_spray", True))),
        is_car_hanger=bool(body.get("is_car_hanger", body.get("is_car_hangover", False))),
        is_featured=bool(body.get("is_featured", False)),
        is_best_seller=bool(body.get("is_best_seller", False)),
        is_new_arrival=bool(body.get("is_new_arrival", False)),
        is_active=bool(body.get("is_active", True)),
        stock_quantity=int(body.get("stock_quantity", 0)),
    )
    db.add(p)
    invalidate_catalog_cache()
    return {"ok": True, "perfume_id": pid}


@router.put("/perfumes/{perfume_id}")
async def update_perfume(perfume_id: str, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Perfume).where(Perfume.perfume_id == perfume_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Perfume not found")
    if "perfume_spray" in body and "is_perfume" not in body:
        body["is_perfume"] = body["perfume_spray"]
    for k in ("perfume_name", "brand", "description", "fragrance_type_id", "is_attar",
              "is_perfume", "is_car_hanger", "is_featured", "is_best_seller", "is_new_arrival", "is_active", "stock_quantity"):
        if k in body:
            setattr(p, k, body[k])
    if "is_car_hangover" in body and "is_car_hanger" not in body:
        p.is_car_hanger = bool(body["is_car_hangover"])
    for k in ("price_6ml", "price_12ml", "price_30ml", "price_50ml"):
        if k in body:
            setattr(p, k, Decimal(str(body[k])) if body[k] is not None else None)
    invalidate_catalog_cache()
    return {"ok": True}


@router.delete("/perfumes/{perfume_id}")
async def delete_perfume(perfume_id: str, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    p = await _get_perfume_or_404(db, perfume_id)
    result = await db.execute(select(PerfumeImage).where(PerfumeImage.perfume_id == perfume_id))
    for img in result.scalars():
        if "res.cloudinary.com" in img.image_url:
            try:
                delete_by_url(img.image_url)
            except Exception:
                pass
        await db.delete(img)
    await db.delete(p)
    invalidate_catalog_cache()
    return {"ok": True}


# ── Perfume Images ─────────────────────────────────────────────────────────────

async def _next_display_order(db, perfume_id):
    from sqlalchemy import func as sqlfunc
    result = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.max(PerfumeImage.display_order), -1))
        .where(PerfumeImage.perfume_id == perfume_id)
    )
    return int(result.scalar_one()) + 1


async def _clear_primary_flags(db, perfume_id):
    result = await db.execute(select(PerfumeImage).where(PerfumeImage.perfume_id == perfume_id))
    for img in result.scalars():
        img.is_primary = False


async def _add_perfume_image(db, perfume_id, image_url, *, is_primary=False, alt_text=None):
    existing = (await db.execute(select(PerfumeImage).where(PerfumeImage.perfume_id == perfume_id))).scalars().all()
    make_primary = is_primary or not existing
    if make_primary:
        await _clear_primary_flags(db, perfume_id)
    img = PerfumeImage(
        perfume_id=perfume_id, image_url=image_url, alt_text=alt_text,
        is_primary=make_primary, display_order=await _next_display_order(db, perfume_id),
    )
    db.add(img)
    await db.flush()
    return img


@router.post("/perfumes/{perfume_id}/images")
async def add_perfume_image_url(perfume_id: str, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await _get_perfume_or_404(db, perfume_id)
    url = (body.get("image_url") or body.get("imageUrl") or "").strip()
    if not url:
        raise HTTPException(status_code=422, detail="image_url required")
    img = await _add_perfume_image(db, perfume_id, url, is_primary=bool(body.get("is_primary")))
    invalidate_catalog_cache()
    return {"id": img.id, "imageUrl": img.image_url, "isPrimary": img.is_primary}


@router.post("/perfumes/{perfume_id}/images/upload")
async def upload_perfume_images(
    perfume_id: str,
    files: list[UploadFile] = File(...),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_perfume_or_404(db, perfume_id)
    if not files:
        raise HTTPException(status_code=422, detail="No files uploaded")
    created = []
    for upload in files:
        if not upload.filename:
            continue
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_IMAGE_EXT:
            raise HTTPException(status_code=422, detail=f"Unsupported file type: {ext}")
        data = await upload.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=422, detail="File too large (max 5 MB)")

        if settings.cloudinary_configured:
            try:
                result = upload_upload_file(data, upload.filename, subfolder="perfumes")
                url = result["secure_url"]
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Cloudinary upload failed: {exc}") from exc
        else:
            PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
            safe_name = f"{_slug(Path(upload.filename).stem)}_{uuid.uuid4().hex[:8]}{ext}"
            target = PRODUCT_UPLOADS_DIR / safe_name
            target.write_bytes(data)
            url = f"/uploads/products/{safe_name}"

        img = await _add_perfume_image(db, perfume_id, url)
        created.append({"id": img.id, "imageUrl": img.image_url, "isPrimary": img.is_primary})
    if not created:
        raise HTTPException(status_code=422, detail="No valid image files")
    invalidate_catalog_cache()
    return {"items": created}


@router.delete("/perfumes/{perfume_id}/images/{image_id}")
async def delete_perfume_image(perfume_id: str, image_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await _get_perfume_or_404(db, perfume_id)
    result = await db.execute(select(PerfumeImage).where(PerfumeImage.id == image_id, PerfumeImage.perfume_id == perfume_id))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if "res.cloudinary.com" in img.image_url:
        try:
            delete_by_url(img.image_url)
        except Exception:
            pass
    elif img.image_url.startswith("/uploads/products/"):
        try:
            local_target = PRODUCT_UPLOADS_DIR / Path(img.image_url).name
            if local_target.is_file():
                local_target.unlink()
        except Exception:
            pass
    was_primary = img.is_primary
    await db.delete(img)
    await db.flush()
    if was_primary:
        remaining = (await db.execute(
            select(PerfumeImage).where(PerfumeImage.perfume_id == perfume_id).order_by(PerfumeImage.display_order, PerfumeImage.id)
        )).scalars().first()
        if remaining:
            remaining.is_primary = True
    invalidate_catalog_cache()
    return {"ok": True}


# ── Banners ────────────────────────────────────────────────────────────────────

@router.get("/banners")
async def admin_banners(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SiteBanner).order_by(SiteBanner.display_order))
    return [
        {"id": b.id, "title": b.title, "subtitle": b.subtitle, "imageUrl": b.image_url,
         "linkUrl": b.link_url, "isActive": b.is_active, "displayOrder": b.display_order}
        for b in result.scalars()
    ]


@router.post("/banners")
async def create_banner(body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    banner = SiteBanner(
        title=body.get("title", "Banner"), subtitle=body.get("subtitle"),
        image_url=body["image_url"], link_url=body.get("link_url"),
        is_active=body.get("is_active", True),
        display_order=body.get("display_order", 0),
    )
    db.add(banner)
    await db.flush()
    invalidate_catalog_cache()
    return {"ok": True, "id": banner.id}


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: int, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SiteBanner).where(SiteBanner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")

    # Reorder within the same active/inactive pool (supermarket-style)
    direction = body.get("direction")
    if direction in ("left", "right"):
        pool = (
            await db.execute(
                select(SiteBanner)
                .where(SiteBanner.is_active.is_(bool(b.is_active)))
                .order_by(SiteBanner.display_order, SiteBanner.id)
            )
        ).scalars().all()
        ids = [x.id for x in pool]
        try:
            idx = ids.index(banner_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Banner not found in pool")
        swap_with = idx - 1 if direction == "left" else idx + 1
        if swap_with < 0 or swap_with >= len(pool):
            return {"ok": True, "moved": False}
        other = pool[swap_with]
        b.display_order, other.display_order = other.display_order, b.display_order
        # If orders were equal, force distinct sequential orders
        if b.display_order == other.display_order:
            for i, row in enumerate(pool):
                row.display_order = i
            # re-apply swap after normalize
            pool[idx].display_order, pool[swap_with].display_order = pool[swap_with].display_order, pool[idx].display_order
        invalidate_catalog_cache()
        await db.commit()
        return {"ok": True, "moved": True}

    for k in ("title", "subtitle", "image_url", "link_url", "is_active", "display_order"):
        if k in body:
            setattr(b, k, body[k])
    invalidate_catalog_cache()
    await db.commit()
    return {"ok": True}


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SiteBanner).where(SiteBanner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    await db.delete(b)
    await db.commit()
    invalidate_catalog_cache()
    return {"ok": True}


@router.post("/banners/upload")
async def upload_banner_image(file: UploadFile = File(...), user: User = Depends(require_admin)):
    if not file.filename:
        raise HTTPException(status_code=422, detail="No file uploaded")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {ext}")
    data = await file.read()
    if len(data) > 12 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="File too large (max 12 MB)")
    if settings.cloudinary_configured:
        try:
            result = upload_upload_file(data, file.filename, subfolder="banners")
            url = result["secure_url"]
            return {"imageUrl": url, "url": url}
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Cloudinary upload failed: {exc}") from exc
    else:
        BANNER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = f"banner_{uuid.uuid4().hex[:8]}{ext}"
        target = BANNER_UPLOADS_DIR / safe_name
        target.write_bytes(data)
        url = f"/uploads/banners/{safe_name}"
        return {"imageUrl": url, "url": url}


# ── Testimonials ───────────────────────────────────────────────────────────────

@router.get("/testimonials")
async def admin_testimonials(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Testimonial).order_by(Testimonial.display_order, Testimonial.id))
    return [
        {"id": t.id, "customerName": t.customer_name, "customerInitial": t.customer_initial,
         "rating": t.rating, "quote": t.quote, "isFeatured": t.is_featured, "displayOrder": t.display_order}
        for t in result.scalars()
    ]


@router.post("/testimonials")
async def create_testimonial(body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    t = Testimonial(
        customer_name=body["customer_name"], customer_initial=body.get("customer_initial"),
        rating=int(body.get("rating", 5)), quote=body["quote"],
        is_featured=bool(body.get("is_featured", True)), display_order=int(body.get("display_order", 0)),
    )
    db.add(t)
    await db.flush()
    invalidate_catalog_cache()
    return {"ok": True, "id": t.id}


@router.put("/testimonials/{tid}")
async def update_testimonial(tid: int, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Testimonial).where(Testimonial.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    for k in ("customer_name", "customer_initial", "rating", "quote", "is_featured", "display_order"):
        if k in body:
            setattr(t, k, body[k])
    invalidate_catalog_cache()
    return {"ok": True}


@router.delete("/testimonials/{tid}")
async def delete_testimonial(tid: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Testimonial).where(Testimonial.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.delete(t)
    invalidate_catalog_cache()
    return {"ok": True}


# ── Site Settings ──────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_site_settings(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.core.site_settings import load_public_site_settings, SITE_SETTING_KEYS
    return await load_public_site_settings(db)


@router.put("/settings")
async def save_site_settings(body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    import json
    from app.core.site_settings import SITE_SETTING_KEYS
    from app.core.catalog import invalidate_admin_site_cache
    for key, value in body.items():
        if key not in SITE_SETTING_KEYS:
            continue
        result = await db.execute(select(SiteSetting).where(SiteSetting.setting_key == key))
        setting = result.scalar_one_or_none()
        val_str = value if isinstance(value, str) else json.dumps(value)
        if setting:
            setting.setting_value = val_str
        else:
            db.add(SiteSetting(setting_key=key, setting_value=val_str, setting_type="text"))
    invalidate_catalog_cache()
    return {"ok": True}


# ── Contact Submissions ────────────────────────────────────────────────────────

@router.get("/contact-submissions")
async def admin_contact_submissions(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContactSubmission).order_by(ContactSubmission.submitted_at.desc()))
    rows = result.scalars().all()
    unread = sum(1 for r in rows if not r.is_read)
    return {
        "total": len(rows), "unread": unread,
        "items": [
            {"id": r.id, "name": r.name, "email": r.email, "phone": r.phone or "",
             "enquiryType": r.enquiry_type or "", "message": r.message,
             "isRead": r.is_read,
             "submittedAt": r.submitted_at.isoformat() if r.submitted_at else ""}
            for r in rows
        ],
    }


@router.put("/contact-submissions/{sid}/read")
async def mark_contact_read(sid: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContactSubmission).where(ContactSubmission.id == sid))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.is_read = True
    await db.commit()
    return {"ok": True}


@router.delete("/contact-submissions/{sid}")
async def delete_contact_submission(sid: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContactSubmission).where(ContactSubmission.id == sid))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    await db.delete(sub)
    await db.commit()
    return {"ok": True}


# ── Low stock ──────────────────────────────────────────────────────────────────

@router.get("/low-stock")
async def admin_low_stock(
    threshold: int = Query(10, ge=0, le=100),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Perfume)
        .where(Perfume.is_active.is_(True), Perfume.stock_quantity <= threshold)
        .order_by(Perfume.stock_quantity.asc(), Perfume.perfume_name.asc())
    )
    rows = result.scalars().all()
    return {
        "threshold": threshold,
        "count": len(rows),
        "items": [
            {
                "perfumeId": p.perfume_id,
                "perfumeName": p.perfume_name,
                "stockQuantity": p.stock_quantity,
                "fragranceTypeId": p.fragrance_type_id,
            }
            for p in rows
        ],
    }


# ── Bulk prices ────────────────────────────────────────────────────────────────

@router.post("/perfumes/bulk-prices")
async def admin_bulk_prices(body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    ids = body.get("perfume_ids") or []
    mode = (body.get("mode") or "absolute").lower()
    prices = body.get("prices") or {}
    percent = body.get("percent")
    if not ids:
        raise HTTPException(status_code=400, detail="perfume_ids required")
    if mode not in ("absolute", "percent"):
        raise HTTPException(status_code=400, detail="mode must be absolute or percent")

    result = await db.execute(select(Perfume).where(Perfume.perfume_id.in_(ids)))
    perfumes = result.scalars().all()
    updated = 0
    fields = ("price_6ml", "price_12ml", "price_30ml", "price_50ml")

    for p in perfumes:
        changed = False
        if mode == "percent":
            try:
                pct = float(percent)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="percent required for percent mode")
            factor = 1 + (pct / 100.0)
            for f in fields:
                cur = getattr(p, f)
                if cur is None:
                    continue
                new_val = Decimal(str(round(float(cur) * factor / 10) * 10))
                setattr(p, f, max(Decimal("0"), new_val))
                changed = True
        else:
            for f in fields:
                if f not in prices or prices[f] is None or prices[f] == "":
                    continue
                setattr(p, f, Decimal(str(prices[f])))
                changed = True
        if changed:
            updated += 1

    invalidate_catalog_cache()
    await db.commit()
    return {"ok": True, "updated": updated}


# ── Orders ─────────────────────────────────────────────────────────────────────

def _order_to_dict(order: Order) -> dict:
    return {
        "id": order.id,
        "orderRef": order.order_ref,
        "status": order.status,
        "customerNote": order.customer_note or "",
        "whatsappMessage": order.whatsapp_message or "",
        "totalUnits": order.total_units,
        "createdAt": order.created_at.isoformat() if order.created_at else "",
        "itemCount": len(order.items or []),
        "items": [
            {
                "perfumeId": i.perfume_id,
                "perfumeName": i.perfume_name,
                "size": i.size,
                "qty": i.qty,
                "price": float(i.price) if i.price is not None else None,
            }
            for i in (order.items or [])
        ],
    }


@router.get("/orders")
async def admin_orders(
    status: str | None = Query(None),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if status:
        q = q.where(Order.status == status)
    result = await db.execute(q)
    rows = result.scalars().all()
    return {"total": len(rows), "items": [_order_to_dict(o) for o in rows]}


@router.get("/orders/{order_id}")
async def admin_get_order(order_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_dict(order)


@router.put("/orders/{order_id}")
async def admin_update_order(order_id: int, body: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    status = body.get("status")
    if status:
        if status not in ("new", "confirmed", "delivered", "cancelled"):
            raise HTTPException(status_code=400, detail="Invalid status")
        order.status = status
    if "customer_note" in body:
        order.customer_note = body.get("customer_note")
    await db.commit()
    await db.refresh(order)
    return _order_to_dict(order)


@router.delete("/orders/{order_id}")
async def admin_delete_order(order_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.delete(order)
    await db.commit()
    return {"ok": True}
