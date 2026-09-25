"""
upload_to_cloudinary.py — Upload local asset images to Cloudinary and update database URLs.

Usage:
    python scripts/upload_to_cloudinary.py --dry-run
    python scripts/upload_to_cloudinary.py
    python scripts/upload_to_cloudinary.py --cloud-name "xxx" --api-key "xxx" --api-secret "xxx"
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.core.catalog import invalidate_catalog_cache
from app.core.cloudinary_storage import configure_cloudinary, get_optimized_url, upload_file_path
from app.models import FragranceType, Perfume, PerfumeImage, SiteBanner, SiteSetting

ASSETS_DIR = PROJECT_ROOT / "frontend" / "assets"


async def upload_and_sync(cloud_name: str, api_key: str, api_secret: str, dry_run: bool = False, db_url_str: str = ""):
    settings = get_settings()

    # 1. Check Cloudinary credentials
    c_name = cloud_name or settings.cloudinary_cloud_name
    c_key = api_key or settings.cloudinary_api_key
    c_sec = api_secret or settings.cloudinary_api_secret

    if not c_name or not c_key or not c_sec or "YOUR_CLOUDINARY" in c_name or "YOUR_CLOUDINARY" in c_key:
        print("\n" + "=" * 70)
        print("[!] ERROR: Valid Cloudinary credentials required!")
        print("=" * 70)
        print("Please replace 'YOUR_CLOUDINARY_*' in your .env file:")
        print("  CLOUDINARY_CLOUD_NAME=your_actual_cloud_name")
        print("  CLOUDINARY_API_KEY=your_actual_api_key")
        print("  CLOUDINARY_API_SECRET=your_actual_api_secret")
        print("\nOr provide them via command-line arguments:")
        print("  python scripts/upload_to_cloudinary.py --cloud-name <name> --api-key <key> --api-secret <sec>")
        print("=" * 70 + "\n")
        return False

    # Override settings for current run
    settings.cloudinary_cloud_name = c_name
    settings.cloudinary_api_key = c_key
    settings.cloudinary_api_secret = c_sec

    target_engine_url = settings.database_url
    if db_url_str:
        from sqlalchemy.engine import make_url
        target_engine_url = make_url(db_url_str)

    print("\n" + "=" * 70)
    print("[CLOUD] AARIF FRAGRANCES -- CLOUDINARY IMAGE SYNC")
    print("=" * 70)
    print(f"Cloud Name:     {c_name}")
    print(f"Target Folder:  {settings.cloudinary_folder}/")
    print(f"Target DB:      {target_engine_url.render_as_string(hide_password=True)}")
    print(f"Dry Run Mode:   {'YES (No changes will be written)' if dry_run else 'NO (Live Upload & DB Update)'}")
    print("=" * 70 + "\n")

    if not dry_run:
        configure_cloudinary()

    # 2. Collect local files to upload
    upload_groups = [
        # (local_folder, cloudinary_subfolder)
        (ASSETS_DIR / "banners", "banners"),
        (ASSETS_DIR / "types", "types"),
        (ASSETS_DIR / "product-types", "product-types"),
    ]

    single_files = [
        (ASSETS_DIR / "bottle-blue.png", "products", "bottle-blue"),
        (ASSETS_DIR / "bottle.png", "products", "bottle"),
        (ASSETS_DIR / "aarif-logo.png", "brand", "aarif-logo"),
        (ASSETS_DIR / "aarif-logo-full.png", "brand", "aarif-logo-full"),
    ]

    uploaded_map = {}  # filename -> secure_url

    # Process folder groups
    for folder_path, subfolder in upload_groups:
        if not folder_path.is_dir():
            continue
        files = sorted([f for f in folder_path.iterdir() if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}])
        print(f">> Processing folder: assets/{folder_path.name}/ ({len(files)} files)")

        for f in files:
            pid = f.stem
            if dry_run:
                fake_url = f"https://res.cloudinary.com/{c_name}/image/upload/{settings.cloudinary_folder}/{subfolder}/{pid}.png"
                uploaded_map[f.name] = fake_url
                print(f"  [DRY-RUN] Would upload {f.name} -> {fake_url}")
            else:
                try:
                    res = upload_file_path(f, folder=subfolder, public_id=pid, overwrite=True)
                    url = res.get("secure_url", "")
                    uploaded_map[f.name] = url
                    print(f"  + Uploaded {f.name} -> {url}")
                except Exception as e:
                    print(f"  - Failed {f.name}: {e}")

    # Process standalone files
    print("\n>> Processing brand & bottle assets:")
    for fpath, subfolder, pid in single_files:
        if not fpath.is_file():
            continue
        if dry_run:
            fake_url = f"https://res.cloudinary.com/{c_name}/image/upload/{settings.cloudinary_folder}/{subfolder}/{pid}.png"
            uploaded_map[fpath.name] = fake_url
            print(f"  [DRY-RUN] Would upload {fpath.name} -> {fake_url}")
        else:
            try:
                res = upload_file_path(fpath, folder=subfolder, public_id=pid, overwrite=True)
                url = res.get("secure_url", "")
                uploaded_map[fpath.name] = url
                print(f"  + Uploaded {fpath.name} -> {url}")
            except Exception as e:
                print(f"  - Failed {fpath.name}: {e}")

    print(f"\nTotal assets mapped: {len(uploaded_map)}")

    # 3. Update database records with Cloudinary URLs
    print("\nUpdating Database image records:")
    db_engine = create_async_engine(
        target_engine_url,
        echo=False,
        connect_args={"statement_cache_size": 0, "timeout": 30, "command_timeout": 60} if "neon.tech" in str(target_engine_url) else {},
    )
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # A. Update fragrance_types
        types = (await session.execute(select(FragranceType))).scalars().all()
        ft_updated = 0
        for ft in types:
            curr = ft.icon_image_url or ""
            filename = Path(curr.split("?")[0]).name
            if filename in uploaded_map:
                new_url = get_optimized_url(uploaded_map[filename], width=240)
                if not dry_run:
                    ft.icon_image_url = new_url
                ft_updated += 1
                print(f"  * FragranceType [{ft.type_id}] {ft.type_name:<20} -> {new_url}")

        # B. Update site_banners
        banners = (await session.execute(select(SiteBanner))).scalars().all()
        sb_updated = 0
        for sb in banners:
            curr = sb.image_url or ""
            filename = Path(curr.split("?")[0]).name
            if filename in uploaded_map:
                new_url = get_optimized_url(uploaded_map[filename], width=1200)
                if not dry_run:
                    sb.image_url = new_url
                sb_updated += 1
                print(f"  * SiteBanner [{sb.id}] {sb.title:<25} -> {new_url}")

        # C. Update perfume_images for all perfumes
        perfumes = (await session.execute(select(Perfume))).scalars().all()
        p_imgs_updated = 0
        raw_bottle_url = uploaded_map.get("bottle-blue.png", uploaded_map.get("bottle.png", ""))
        default_bottle_url = get_optimized_url(raw_bottle_url, width=400) if raw_bottle_url else ""

        if default_bottle_url:
            for p in perfumes:
                # Check if perfume already has an image
                existing = (await session.execute(
                    select(PerfumeImage).where(PerfumeImage.perfume_id == p.perfume_id)
                )).scalar_one_or_none()

                if not existing:
                    if not dry_run:
                        new_img = PerfumeImage(
                            perfume_id=p.perfume_id,
                            image_url=default_bottle_url,
                            alt_text=p.perfume_name,
                            is_primary=True,
                            display_order=0,
                        )
                        session.add(new_img)
                    p_imgs_updated += 1
                else:
                    opt_url = get_optimized_url(existing.image_url or default_bottle_url, width=400)
                    if existing.image_url != opt_url:
                        if not dry_run:
                            existing.image_url = opt_url
                        p_imgs_updated += 1

            print(f"  * Perfume Images synchronized for {p_imgs_updated} perfumes.")

        # D. Update site_settings logo if applicable
        logo_url = uploaded_map.get("aarif-logo.png")
        if logo_url:
            logo_setting = (await session.execute(
                select(SiteSetting).where(SiteSetting.setting_key == "logo_url")
            )).scalar_one_or_none()
            if logo_setting:
                if not dry_run:
                    logo_setting.setting_value = logo_url
                print(f"  * SiteSetting [logo_url] updated -> {logo_url}")

        if not dry_run:
            await session.commit()
            invalidate_catalog_cache()
            print("\n[OK] Database transaction committed and catalog cache invalidated.")
        else:
            print("\n[DRY-RUN] No database modifications committed.")

    await db_engine.dispose()
    print("\n" + "=" * 70)
    print("[SUCCESS] CLOUDINARY SYNC COMPLETE!")
    print(f"   Fragrance Types updated: {ft_updated}")
    print(f"   Site Banners updated:    {sb_updated}")
    print(f"   Perfume Images updated:  {p_imgs_updated}")
    print("=" * 70 + "\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Upload Aarif Fragrances assets to Cloudinary and sync DB")
    parser.add_argument("--cloud-name", help="Cloudinary Cloud Name")
    parser.add_argument("--api-key", help="Cloudinary API Key")
    parser.add_argument("--api-secret", help="Cloudinary API Secret")
    parser.add_argument("--dry-run", action="store_true", help="Simulate upload without writing to Cloudinary or DB")
    parser.add_argument("--db-url", help="Database connection URL (defaults to configured database in .env)")
    args = parser.parse_args()

    asyncio.run(upload_and_sync(
        cloud_name=args.cloud_name or "",
        api_key=args.api_key or "",
        api_secret=args.api_secret or "",
        dry_run=args.dry_run,
        db_url_str=args.db_url or "",
    ))


if __name__ == "__main__":
    main()
