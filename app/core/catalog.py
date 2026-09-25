"""In-memory TTL cache for catalog data with cross-process invalidation."""

import time
from pathlib import Path
from typing import Any

from app.core.cloudinary_storage import get_optimized_url

_CACHE_TTL = 1800  # 30 minutes
_CACHE_MAX_ENTRIES = 500
_cache: dict[str, tuple[float, Any]] = {}

_INVALIDATION_FILE = Path(__file__).parent / ".cache_invalidated"


def _invalidation_time() -> float:
    try:
        return _INVALIDATION_FILE.stat().st_mtime
    except OSError:
        return 0.0


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if not entry:
        return None
    store_wall, value = entry[0], entry[1]
    if time.time() - store_wall >= _CACHE_TTL:
        return None
    if _invalidation_time() > store_wall:
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        sorted_keys = sorted(_cache, key=lambda k: _cache[k][0])
        for old_key in sorted_keys[: _CACHE_MAX_ENTRIES // 4]:
            _cache.pop(old_key, None)
    _cache[key] = (time.time(), value)


def invalidate_catalog_cache() -> None:
    _cache.clear()
    try:
        _INVALIDATION_FILE.touch()
    except OSError:
        pass


def admin_cache_get(key: str) -> Any | None:
    return _cache_get(f"admin:{key}")


def admin_cache_set(key: str, value: Any) -> None:
    _cache_set(f"admin:{key}", value)


def admin_cache_invalidate(*keys: str) -> None:
    for key in keys:
        _cache.pop(f"admin:{key}", None)


def invalidate_admin_site_cache(*admin_keys: str) -> None:
    if admin_keys:
        admin_cache_invalidate(*admin_keys)
    invalidate_catalog_cache()


def primary_image_url(perfume) -> str | None:
    for img in perfume.images:
        if img.is_primary:
            return img.image_url
    return perfume.images[0].image_url if perfume.images else None


def perfume_to_dict(p, primary_image: str | None = None) -> dict[str, Any]:
    return {
        "perfumeId": p.perfume_id,
        "fragranceTypeId": p.fragrance_type_id,
        "fragranceTypeName": p.fragrance_type.type_name if p.fragrance_type else "",
        "perfumeName": p.perfume_name,
        "displayName": p.perfume_name,
        "brand": p.brand or "",
        "description": p.description or "",
        "price6ml": float(p.price_6ml) if p.price_6ml is not None else None,
        "price12ml": float(p.price_12ml) if p.price_12ml is not None else None,
        "price30ml": float(p.price_30ml) if p.price_30ml is not None else None,
        "price50ml": float(p.price_50ml) if p.price_50ml is not None else None,
        "isAttar": bool(p.is_attar),
        "isPerfume": bool(getattr(p, "is_perfume", False)),
        "isCarHanger": bool(getattr(p, "is_car_hanger", False)),
        "isFeatured": bool(p.is_featured),
        "isBestSeller": bool(p.is_best_seller),
        "isNewArrival": bool(p.is_new_arrival),
        "primaryImageUrl": get_optimized_url(primary_image, width=400) if primary_image else None,
    }
