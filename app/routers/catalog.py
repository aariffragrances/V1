"""Public catalog API for Aarif Fragrances."""

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.catalog import (
    _cache_get,
    _cache_set,
    perfume_to_dict,
    primary_image_url,
)
from app.core.cloudinary_storage import get_optimized_url
from app.core.site_settings import load_public_site_settings
from app.database import get_db
from app.models import FragranceType, Perfume, SiteBanner, Testimonial
from app.schemas import (
    BootstrapOut,
    CatalogMetadataOut,
    CatalogProductsBulkOut,
    BannerOut,
    TestimonialOut,
    FragranceTypeOut,
    PerfumeOut,
    PerfumeListResponse,
)

router = APIRouter(prefix="/api/v1", tags=["catalog"])


async def _load_active_perfumes(db: AsyncSession) -> list[dict]:
    cached = _cache_get("active_perfumes")
    if cached is not None:
        return cached

    result = await db.execute(text("""
        SELECT
            p.perfume_id,
            p.perfume_name,
            p.fragrance_type_id,
            ft.type_name,
            p.brand,
            p.description,
            p.price_6ml,
            p.price_12ml,
            p.price_30ml,
            p.price_50ml,
            p.is_attar,
            p.is_perfume,
            p.is_car_hanger,
            p.is_featured,
            p.is_best_seller,
            p.is_new_arrival,
            pi.image_url AS primary_image_url
        FROM perfumes p
        JOIN fragrance_types ft ON ft.type_id = p.fragrance_type_id
        LEFT JOIN LATERAL (
            SELECT image_url
            FROM perfume_images
            WHERE perfume_id = p.perfume_id
            ORDER BY is_primary DESC, display_order ASC, id ASC
            LIMIT 1
        ) pi ON true
        WHERE p.is_active = true AND ft.is_active = true
        ORDER BY ft.display_order, p.perfume_name
    """))

    perfumes = []
    for row in result.fetchall():
        perfumes.append({
            "perfumeId": row.perfume_id,
            "fragranceTypeId": row.fragrance_type_id,
            "fragranceTypeName": row.type_name or "",
            "perfumeName": row.perfume_name,
            "displayName": row.perfume_name,
            "brand": row.brand or "",
            "description": row.description or "",
            "price6ml": float(row.price_6ml) if row.price_6ml is not None else None,
            "price12ml": float(row.price_12ml) if row.price_12ml is not None else None,
            "price30ml": float(row.price_30ml) if row.price_30ml is not None else None,
            "price50ml": float(row.price_50ml) if row.price_50ml is not None else None,
            "isAttar": bool(row.is_attar),
            "isPerfume": bool(row.is_perfume),
            "isCarHanger": bool(row.is_car_hanger),
            "isFeatured": bool(row.is_featured),
            "isBestSeller": bool(row.is_best_seller),
            "isNewArrival": bool(row.is_new_arrival),
            "primaryImageUrl": get_optimized_url(row.primary_image_url, width=400) if row.primary_image_url else None,
        })

    _cache_set("active_perfumes", perfumes)
    return perfumes


async def _load_fragrance_types(db: AsyncSession) -> list[dict]:
    cached = _cache_get("fragrance_types")
    if cached is not None:
        return cached

    result = await db.execute(text("""
        SELECT ft.type_id, ft.type_name, ft.description, ft.icon_image_url, ft.display_order,
               COUNT(p.perfume_id) AS product_count
        FROM fragrance_types ft
        LEFT JOIN perfumes p ON p.fragrance_type_id = ft.type_id AND p.is_active = true
        WHERE ft.is_active = true
        GROUP BY ft.type_id, ft.type_name, ft.description, ft.icon_image_url, ft.display_order
        ORDER BY ft.display_order
    """))

    types = [
        {
            "type_id": row.type_id,
            "type_name": row.type_name,
            "description": row.description or "",
            "icon_image_url": get_optimized_url(row.icon_image_url or "", width=240),
            "display_order": row.display_order,
            "product_count": row.product_count,
        }
        for row in result.fetchall()
    ]

    _cache_set("fragrance_types", types)
    return types


async def _load_active_banners(db: AsyncSession) -> list[dict]:
    cached = _cache_get("active_banners")
    if cached is not None:
        return cached

    result = await db.execute(
        select(SiteBanner)
        .where(SiteBanner.is_active.is_(True))
        .order_by(SiteBanner.display_order)
    )
    banners = [
        {
            "id": b.id,
            "title": b.title,
            "subtitle": b.subtitle,
            "imageUrl": get_optimized_url(b.image_url, width=1200) if b.image_url else "",
            "linkUrl": b.link_url or "products.html",
        }
        for b in result.scalars()
    ]
    _cache_set("active_banners", banners)
    return banners


_CATALOG_CACHE_CONTROL = "public, max-age=180, stale-while-revalidate=86400"


@router.get("/catalog/metadata", response_model=CatalogMetadataOut)
async def catalog_metadata(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = _CATALOG_CACHE_CONTROL
    fragrance_types = await _load_fragrance_types(db)
    site_settings = await load_public_site_settings(db)
    banners = await _load_active_banners(db)
    return CatalogMetadataOut(
        fragranceTypes=fragrance_types,
        siteSettings=site_settings,
        promotionBanners=banners,
    )


@router.get("/catalog/perfumes-bulk", response_model=CatalogProductsBulkOut)
async def catalog_perfumes_bulk(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = _CATALOG_CACHE_CONTROL
    return CatalogProductsBulkOut(perfumes=await _load_active_perfumes(db))


@router.get("/catalog/bootstrap", response_model=BootstrapOut)
async def catalog_bootstrap(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = _CATALOG_CACHE_CONTROL
    fragrance_types = await _load_fragrance_types(db)
    perfumes = await _load_active_perfumes(db)
    site_settings = await load_public_site_settings(db)
    banners = await _load_active_banners(db)
    return BootstrapOut(
        fragranceTypes=fragrance_types,
        perfumes=perfumes,
        promotionBanners=banners,
        siteSettings=site_settings,
    )


@router.get("/catalog/cart-perfumes", response_model=CatalogProductsBulkOut)
async def catalog_cart_perfumes(
    names: str = Query(..., description="Comma-separated perfume names in the basket"),
    db: AsyncSession = Depends(get_db),
):
    name_list = [n.strip() for n in names.split(",") if n.strip()]
    if not name_list:
        return CatalogProductsBulkOut(perfumes=[])
    if len(name_list) > 100:
        raise HTTPException(status_code=400, detail="Too many perfume names requested")
    all_perfumes = await _load_active_perfumes(db)
    wanted = set(name_list)
    matched = [p for p in all_perfumes if p.get("perfumeName") in wanted]
    return CatalogProductsBulkOut(perfumes=matched)


@router.get("/fragrance-types", response_model=list[FragranceTypeOut])
async def list_fragrance_types(db: AsyncSession = Depends(get_db)):
    return await _load_fragrance_types(db)


@router.get("/perfumes")
async def list_perfumes(
    fragrance_type: str | None = None,
    search: str | None = None,
    sort_by: str = Query("name-asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    all_perfumes = await _load_active_perfumes(db)

    filtered = list(all_perfumes)
    if fragrance_type:
        filtered = [p for p in filtered if p["fragranceTypeId"] == fragrance_type or p["fragranceTypeName"].lower() == fragrance_type.lower()]
    if search:
        q = search.strip().lower()
        filtered = [p for p in filtered if q in p["perfumeName"].lower() or q in p["fragranceTypeName"].lower() or q in p.get("brand", "").lower()]

    def _min_price(p: dict) -> float:
        prices = [p[k] for k in ("price6ml", "price12ml", "price30ml", "price50ml") if p.get(k) is not None]
        return min(prices) if prices else 0.0

    if sort_by == "name-asc":
        filtered.sort(key=lambda x: x["perfumeName"].lower())
    elif sort_by == "name-desc":
        filtered.sort(key=lambda x: x["perfumeName"].lower(), reverse=True)
    elif sort_by == "price-asc":
        filtered.sort(key=_min_price)
    elif sort_by == "price-desc":
        filtered.sort(key=_min_price, reverse=True)

    total = len(filtered)
    total_pages = max(1, (total + per_page - 1) // per_page)
    start = (page - 1) * per_page
    items = filtered[start:start + per_page]

    return {
        "items": items,
        "total_count": total,
        "total_pages": total_pages,
        "current_page": page,
        "per_page": per_page,
    }


@router.get("/perfumes/featured")
async def featured_perfumes(limit: int = Query(12, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    all_p = await _load_active_perfumes(db)
    return [p for p in all_p if p.get("isFeatured")][:limit]


@router.get("/perfumes/best-sellers")
async def best_seller_perfumes(limit: int = Query(12, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    all_p = await _load_active_perfumes(db)
    return [p for p in all_p if p.get("isBestSeller")][:limit]


@router.get("/perfumes/new-arrivals")
async def new_arrival_perfumes(limit: int = Query(12, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    all_p = await _load_active_perfumes(db)
    return [p for p in all_p if p.get("isNewArrival")][:limit]


@router.get("/perfumes/{perfume_id}")
async def get_perfume(perfume_id: str, db: AsyncSession = Depends(get_db)):
    pid = perfume_id.strip()
    result = await db.execute(
        select(Perfume)
        .options(selectinload(Perfume.fragrance_type), selectinload(Perfume.images))
        .where(
            or_(
                Perfume.perfume_id == pid,
                Perfume.perfume_id == pid.upper(),
                Perfume.slug == pid.lower(),
                func.lower(Perfume.perfume_name) == pid.lower(),
            )
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Perfume not found")
    return perfume_to_dict(p, primary_image_url(p))


@router.get("/testimonials", response_model=list[TestimonialOut])
async def list_testimonials(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = _CATALOG_CACHE_CONTROL
    cached = _cache_get("public_testimonials")
    if cached is not None:
        return cached

    result = await db.execute(
        select(Testimonial)
        .where(Testimonial.is_featured.is_(True))
        .order_by(Testimonial.display_order)
    )
    testimonials = [
        TestimonialOut(
            initials=t.customer_initial or (t.customer_name[:2] if t.customer_name else "??"),
            name=t.customer_name,
            text=t.quote,
            rating=t.rating,
        )
        for t in result.scalars()
    ]
    _cache_set("public_testimonials", testimonials)
    return testimonials


@router.get("/banners", response_model=list[BannerOut])
async def list_banners(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SiteBanner)
        .where(SiteBanner.is_active.is_(True))
        .order_by(SiteBanner.display_order)
    )
    return [
        BannerOut(id=b.id, title=b.title, subtitle=b.subtitle,
                  image_url=b.image_url, link_url=b.link_url, display_order=b.display_order)
        for b in result.scalars()
    ]
