"""
Upload 8 specified perfume images to Cloudinary, update Neon PostgreSQL database records,
and sync catalog metadata without affecting any website structure.
"""

import asyncio
import json
import shutil
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from sqlalchemy import select
from app.config import get_settings
from app.core.catalog import invalidate_catalog_cache
from app.core.cloudinary_storage import configure_cloudinary, get_optimized_url, upload_file_path
from app.database import AsyncSessionLocal
from app.models.catalog import Perfume, PerfumeImage

BATCH_ITEMS = [
    {
        "filename": "MAJMUA.png",
        "perfume_id": "PF051",
        "perfume_name": "Majmua",
        "public_id": "majmua"
    },
    {
        "filename": "JANNAT FIRDAUS.png",
        "perfume_id": "PF050",
        "perfume_name": "Jannat Firdaus",
        "public_id": "jannat-firdaus"
    },
    {
        "filename": "VANNILA.png",
        "perfume_id": "PF037",
        "perfume_name": "Vanilla",
        "public_id": "vanilla"
    },
    {
        "filename": "Musk Rijali.png",
        "perfume_id": "PF052",
        "perfume_name": "Musk Rijali",
        "public_id": "musk-rijali"
    },
    {
        "filename": "Khamrah.png",
        "perfume_id": "PF039",
        "perfume_name": "Khamrah",
        "public_id": "khamrah"
    },
    {
        "filename": "SANDAL.png",
        "perfume_id": "PF031",
        "perfume_name": "Sandal",
        "public_id": "sandal"
    },
    {
        "filename": "MAGNET.png",
        "perfume_id": "PF035",
        "perfume_name": "Magnet",
        "public_id": "magnet"
    },
    {
        "filename": "JAGUAR BLACK.png",
        "perfume_id": "PF034",
        "perfume_name": "Jaguar Black",
        "public_id": "jaguar-black"
    },
]


async def run():
    settings = get_settings()
    print("=" * 75)
    print("AARIF FRAGRANCES — UPLOAD 8 PRODUCT IMAGES TO CLOUDINARY & UPDATE DB")
    print("=" * 75)
    print(f"Cloud Name: {settings.cloudinary_cloud_name}")
    print(f"Target:     {settings.cloudinary_folder}/products")
    print("=" * 75)

    configure_cloudinary()

    source_dir = PROJECT_ROOT / "product images"
    assets_dir = PROJECT_ROOT / "frontend" / "assets" / "Product images"
    assets_dir.mkdir(parents=True, exist_ok=True)

    upload_results = {}

    for idx, item in enumerate(BATCH_ITEMS, 1):
        src_path = source_dir / item["filename"]
        if not src_path.is_file():
            print(f"[{idx}/{len(BATCH_ITEMS)}] ERROR: Source file not found: {src_path}")
            continue

        # Keep a local copy in assets folder
        dest_asset = assets_dir / item["filename"]
        try:
            shutil.copy2(src_path, dest_asset)
        except Exception as e:
            print(f"  Note: copy to assets: {e}")

        print(f"[{idx}/{len(BATCH_ITEMS)}] Uploading '{item['filename']}' for {item['perfume_name']} ({item['perfume_id']})...")
        try:
            res = upload_file_path(
                src_path,
                folder="products",
                public_id=item["public_id"],
                overwrite=True,
            )
            secure_url = res.get("secure_url")
            upload_results[item["perfume_id"]] = {
                "url": secure_url,
                "item": item,
            }
            print(f"    -> Cloudinary URL: {secure_url}")
        except Exception as e:
            print(f"    -> ERROR during upload: {e}")

    print("\n" + "=" * 75)
    print(f"Successfully uploaded {len(upload_results)} of {len(BATCH_ITEMS)} images to Cloudinary.")
    print("Updating Neon PostgreSQL Database...")
    print("=" * 75)

    async with AsyncSessionLocal() as session:
        for pid, data in upload_results.items():
            secure_url = data["url"]
            item = data["item"]
            perfume_name = item["perfume_name"]

            perfume = await session.get(Perfume, pid)
            if not perfume:
                print(f"  Warning: Perfume {pid} not found in database!")
                continue

            stmt = select(PerfumeImage).where(PerfumeImage.perfume_id == pid)
            res = await session.execute(stmt)
            images = res.scalars().all()

            if images:
                primary_img = next((img for img in images if img.is_primary), images[0])
                primary_img.image_url = secure_url
                primary_img.alt_text = f"{perfume_name} - Aarif Fragrances"
                primary_img.is_primary = True
                print(f"  * Updated PerfumeImage record (ID: {primary_img.id}) for [{pid}] {perfume_name} -> {secure_url}")
            else:
                new_img = PerfumeImage(
                    perfume_id=pid,
                    image_url=secure_url,
                    alt_text=f"{perfume_name} - Aarif Fragrances",
                    is_primary=True,
                    display_order=0,
                )
                session.add(new_img)
                print(f"  + Created new PerfumeImage record for [{pid}] {perfume_name} -> {secure_url}")

        await session.commit()
        print("Database commit successful!")

    # Invalidate catalog cache
    try:
        invalidate_catalog_cache()
        print("Backend catalog cache invalidated.")
    except Exception as e:
        print(f"Cache invalidation note: {e}")

    # Update data/cloudinary_urls.json
    cloudinary_json_path = PROJECT_ROOT / "data" / "cloudinary_urls.json"
    if cloudinary_json_path.is_file():
        try:
            urls_map = json.loads(cloudinary_json_path.read_text(encoding="utf-8"))
            for pid, data in upload_results.items():
                item = data["item"]
                url = data["url"]
                urls_map[f"products/{item['filename']}"] = url
                urls_map[f"products/{item['public_id']}"] = url
                urls_map[f"products/{item['filename'].rsplit('.', 1)[0]}"] = url
            cloudinary_json_path.write_text(json.dumps(urls_map, indent=2), encoding="utf-8")
            print("Updated data/cloudinary_urls.json.")
        except Exception as e:
            print(f"Failed to update data/cloudinary_urls.json: {e}")

    # Update frontend/data and data static JSON caches
    json_targets = [
        PROJECT_ROOT / "frontend" / "data" / "perfumes.json",
        PROJECT_ROOT / "frontend" / "data" / "bootstrap.json",
        PROJECT_ROOT / "data" / "perfumes.json",
        PROJECT_ROOT / "data" / "bootstrap.json",
    ]

    for json_file in json_targets:
        if not json_file.is_file():
            continue
        try:
            content = json.loads(json_file.read_text(encoding="utf-8"))
            items_list = content.get("perfumes", content) if isinstance(content, dict) else content
            if isinstance(items_list, list):
                updated_count = 0
                for p in items_list:
                    p_id = p.get("perfumeId") or p.get("perfume_id")
                    if p_id in upload_results:
                        p["primaryImageUrl"] = get_optimized_url(upload_results[p_id]["url"], width=400)
                        p["primary_image_url"] = upload_results[p_id]["url"]
                        updated_count += 1
                json_file.write_text(json.dumps(content, indent=2), encoding="utf-8")
                print(f"Updated {updated_count} perfumes in {json_file.name}.")
        except Exception as e:
            print(f"Failed to update {json_file.name}: {e}")

    print("\n" + "=" * 75)
    print("ALL 8 PRODUCT IMAGES UPLOADED AND DATABASE UPDATED PERFECTLY!")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(run())
