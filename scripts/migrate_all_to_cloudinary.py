import asyncio
import os
import sys
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import get_settings
from app.core.cloudinary_storage import configure_cloudinary, upload_file_path, get_optimized_url
from app.core.catalog import invalidate_catalog_cache
from app.models import FragranceType, Perfume, PerfumeImage, SiteBanner, SiteSetting

ASSETS_DIR = PROJECT_ROOT / "frontend" / "assets"

def clean_pid(filename: str) -> str:
    # replace spaces and invalid characters with hyphens
    name = Path(filename).stem
    cleaned = re.sub(r'[^a-zA-Z0-9_\-]+', '-', name).strip('-').lower()
    return cleaned

async def run_migration():
    settings = get_settings()
    configure_cloudinary()
    c_name = settings.cloudinary_cloud_name
    print(f"=== CLOUDINARY COMPLETE MIGRATION ({c_name}) ===")

    uploaded = {} # key -> secure_url

    # 1. Product Types
    pt_dir = ASSETS_DIR / "product-types"
    if pt_dir.is_dir():
        print("\nUploading product-types images...")
        for f in sorted(pt_dir.iterdir()):
            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                pid = clean_pid(f.name)
                res = upload_file_path(f, folder="product-types", public_id=pid, overwrite=True)
                url = res["secure_url"]
                uploaded[f"product-types/{f.name}"] = url
                uploaded[f"product-types/{pid}"] = url
                print(f"  [product-types] {f.name} -> {url}")

    # 2. Fragrance Type category icons
    types_dir = ASSETS_DIR / "types"
    if types_dir.is_dir():
        print("\nUploading fragrance family category icons...")
        for f in sorted(types_dir.iterdir()):
            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                pid = clean_pid(f.name)
                res = upload_file_path(f, folder="types", public_id=pid, overwrite=True)
                url = res["secure_url"]
                uploaded[f"types/{f.name}"] = url
                print(f"  [types] {f.name} -> {url}")

    # 3. Banners
    banners_dir = ASSETS_DIR / "banners"
    if banners_dir.is_dir():
        print("\nUploading banners...")
        for f in sorted(banners_dir.iterdir()):
            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                pid = clean_pid(f.name)
                res = upload_file_path(f, folder="banners", public_id=pid, overwrite=True)
                url = res["secure_url"]
                uploaded[f"banners/{f.name}"] = url
                print(f"  [banners] {f.name} -> {url}")

    # 4. Product images (custom bottles)
    prod_dir = ASSETS_DIR / "Product images"
    if prod_dir.is_dir():
        print("\nUploading custom product images...")
        for f in sorted(prod_dir.iterdir()):
            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                pid = clean_pid(f.name)
                res = upload_file_path(f, folder="products", public_id=pid, overwrite=True)
                url = res["secure_url"]
                uploaded[f"products/{f.name}"] = url
                uploaded[f"products/{pid}"] = url
                print(f"  [products] {f.name} -> {url}")

    # 5. Core assets (logos and default bottles)
    print("\nUploading brand and bottle assets...")
    core_files = [
        (ASSETS_DIR / "aarif-logo.png", "brand", "aarif-logo"),
        (ASSETS_DIR / "aarif-logo-full.png", "brand", "aarif-logo-full"),
        (ASSETS_DIR / "bottle-blue.png", "products", "bottle-blue"),
        (ASSETS_DIR / "bottle.png", "products", "bottle"),
        (ASSETS_DIR / "menu-card.png", "brand", "menu-card"),
    ]
    for p, subfolder, pid in core_files:
        if p.is_file():
            res = upload_file_path(p, folder=subfolder, public_id=pid, overwrite=True)
            url = res["secure_url"]
            uploaded[p.name] = url
            print(f"  [{subfolder}] {p.name} -> {url}")

    # Save mapping to json for frontend/server reference
    out_map_file = PROJECT_ROOT / "data" / "cloudinary_urls.json"
    import json
    out_map_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_map_file, "w", encoding="utf-8") as fp:
        json.dump(uploaded, fp, indent=2)
    print(f"\nSaved Cloudinary URL mapping to {out_map_file}")

    # 6. Update PostgreSQL Database
    print("\nUpdating Neon PostgreSQL Database...")
    db_engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"statement_cache_size": 0, "timeout": 30, "command_timeout": 60} if "neon.tech" in str(settings.database_url) else {},
    )
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    default_bottle_url = uploaded.get("bottle-blue.png", uploaded.get("bottle.png"))

    async with Session() as session:
        # A. Update fragrance_types
        types = (await session.execute(select(FragranceType))).scalars().all()
        for ft in types:
            slug = ft.slug.lower()
            key_png = f"types/{slug}.png"
            if key_png in uploaded:
                ft.icon_image_url = uploaded[key_png]
                print(f"  Updated FragranceType [{ft.type_id}] {ft.type_name} -> {ft.icon_image_url}")
            else:
                # Try finding matching icon
                for k, u in uploaded.items():
                    if k.startswith("types/") and slug in k:
                        ft.icon_image_url = u
                        print(f"  Matched FragranceType [{ft.type_id}] {ft.type_name} -> {u}")
                        break

        # B. Update site_banners
        banners = (await session.execute(select(SiteBanner))).scalars().all()
        for b in banners:
            curr = b.image_url or ""
            fname = Path(curr.split("?")[0]).name
            key = f"banners/{fname}"
            if key in uploaded:
                b.image_url = uploaded[key]
                print(f"  Updated SiteBanner [{b.id}] {b.title} -> {b.image_url}")

        # C. Update perfume_images
        perfumes = (await session.execute(select(Perfume))).scalars().all()
        for p in perfumes:
            p_name_norm = clean_pid(p.perfume_name)
            # Find in uploaded products
            matched_url = None
            for k, u in uploaded.items():
                if k.startswith("products/"):
                    stem = Path(k).stem.lower().replace('-', '').replace('_', '').replace(' ', '')
                    p_clean = p_name_norm.replace('-', '').replace('_', '').replace(' ', '')
                    if stem == p_clean or (len(p_clean) > 4 and p_clean in stem) or (len(stem) > 4 and stem in p_clean):
                        matched_url = u
                        break

            chosen_url = matched_url or default_bottle_url

            # Query existing perfume_images
            res = await session.execute(select(PerfumeImage).where(PerfumeImage.perfume_id == p.perfume_id))
            img_records = res.scalars().all()
            if img_records:
                for img in img_records:
                    # If it's a local path or old url or we found a specific matched_url
                    if matched_url or "assets/" in (img.image_url or "") or "bottle-blue" in (img.image_url or ""):
                        img.image_url = chosen_url
                print(f"  Updated PerfumeImage for [{p.perfume_id}] {p.perfume_name} -> {chosen_url}")
            else:
                new_img = PerfumeImage(
                    perfume_id=p.perfume_id,
                    image_url=chosen_url,
                    alt_text=p.perfume_name,
                    is_primary=True,
                    display_order=0
                )
                session.add(new_img)
                print(f"  Added PerfumeImage for [{p.perfume_id}] {p.perfume_name} -> {chosen_url}")

        # D. Update site_settings
        if "aarif-logo.png" in uploaded:
            logo_url = uploaded["aarif-logo.png"]
            res = await session.execute(select(SiteSetting).where(SiteSetting.setting_key == "store_logo_url"))
            s = res.scalar_one_or_none()
            if s:
                s.setting_value = logo_url
            else:
                session.add(SiteSetting(setting_key="store_logo_url", setting_value=logo_url, setting_type="text"))
            print(f"  Updated SiteSetting store_logo_url -> {logo_url}")

        await session.commit()
        invalidate_catalog_cache()
        print("\n[SUCCESS] Database updated successfully and cache invalidated!")

    await db_engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
