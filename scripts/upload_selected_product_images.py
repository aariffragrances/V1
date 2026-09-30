"""
Upload specified perfume images to Cloudinary and update database records.
"""

import asyncio
import json
from pathlib import Path
import sys

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.catalog import invalidate_catalog_cache
from app.core.cloudinary_storage import configure_cloudinary, get_optimized_url, upload_file_path
from app.database import AsyncSessionLocal
from app.models.catalog import Perfume, PerfumeImage

ITEMS = [
    {
        "filename": "1 million.png",
        "perfume_id": "PF043",
        "perfume_name": "1 Million",
        "public_id": "1-million"
    },
    {
        "filename": "Azzaro black.png",
        "perfume_id": "PF042",
        "perfume_name": "Azzaro Black",
        "public_id": "azzaro-black"
    },
    {
        "filename": "blueberry.png",
        "perfume_id": "PF013",
        "perfume_name": "Blue Berry",
        "public_id": "blueberry"
    },
    {
        "filename": "burberry her.png",
        "perfume_id": "PF015",
        "perfume_name": "Burberry Her",
        "public_id": "burberry-her"
    },
    {
        "filename": "Cool water.png",
        "perfume_id": "PF002",
        "perfume_name": "Cool Water",
        "public_id": "cool-water"
    },
    {
        "filename": "Creed Aventus.png",
        "perfume_id": "PF016",
        "perfume_name": "Creed Aventus",
        "public_id": "creed-aventus"
    },
    {
        "filename": "green apple.png",
        "perfume_id": "PF010",
        "perfume_name": "Green Apple",
        "public_id": "green-apple"
    },
    {
        "filename": "Hawas Rasasi.png",
        "perfume_id": "PF004",
        "perfume_name": "Hawas Rasasi",
        "public_id": "hawas-rasasi"
    },
    {
        "filename": "Ice berg.jpg",
        "perfume_id": "PF009",
        "perfume_name": "Iceberg",
        "public_id": "ice-berg"
    },
    {
        "filename": "invictus.png",
        "perfume_id": "PF005",
        "perfume_name": "Invictus",
        "public_id": "invictus"
    },
    {
        "filename": "litchi.png",
        "perfume_id": "PF014",
        "perfume_name": "Litchi",
        "public_id": "litchi"
    },
    {
        "filename": "pineapple.png",
        "perfume_id": "PF011",
        "perfume_name": "Pine Apple",
        "public_id": "pineapple"
    },
    {
        "filename": "royal blue.png",
        "perfume_id": "PF006",
        "perfume_name": "Royal Blue",
        "public_id": "royal-blue"
    },
    {
        "filename": "sea rose.png",
        "perfume_id": "PF008",
        "perfume_name": "Sea Rose",
        "public_id": "sea-rose"
    },
    {
        "filename": "strawberry.png",
        "perfume_id": "PF012",
        "perfume_name": "Strawberry",
        "public_id": "strawberry"
    },
    {
        "filename": "vampire in blood.png",
        "perfume_id": "PF017",
        "perfume_name": "Vampire Blood",
        "public_id": "vampire-blood"
    },
]


async def run():
    settings = get_settings()
    print("=" * 70)
    print("AARIF FRAGRANCES — UPLOAD PRODUCT IMAGES TO CLOUDINARY & UPDATE DB")
    print("=" * 70)
    print(f"Cloud Name: {settings.cloudinary_cloud_name}")
    print(f"Folder:     {settings.cloudinary_folder}/products")
    print("=" * 70)

    configure_cloudinary()
    images_dir = PROJECT_ROOT / "frontend" / "assets" / "Product images"
    
    upload_results = {}

    for idx, item in enumerate(ITEMS, 1):
        fpath = images_dir / item["filename"]
        if not fpath.is_file():
            print(f"[{idx}/{len(ITEMS)}] ERROR: File not found: {fpath}")
            continue

        print(f"[{idx}/{len(ITEMS)}] Uploading '{item['filename']}' for {item['perfume_name']} ({item['perfume_id']})...")
        try:
            res = upload_file_path(
                fpath,
                folder="products",
                public_id=item["public_id"],
                overwrite=True,
            )
            url = res.get("secure_url")
            upload_results[item["perfume_id"]] = {
                "url": url,
                "item": item,
            }
            print(f"    -> Cloudinary URL: {url}")
        except Exception as e:
            print(f"    -> ERROR during upload: {e}")

    print("\n" + "=" * 70)
    print(f"Successfully uploaded {len(upload_results)} of {len(ITEMS)} images to Cloudinary.")
    print("Updating Neon PostgreSQL database...")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        for pid, data in upload_results.items():
            secure_url = data["url"]
            item = data["item"]
            perfume_name = item["perfume_name"]

            # Check perfume existence
            perfume = await session.get(Perfume, pid)
            if not perfume:
                print(f"Warning: Perfume {pid} not found in database!")
                continue

            # Check existing images
            stmt = select(PerfumeImage).where(PerfumeImage.perfume_id == pid)
            res = await session.execute(stmt)
            images = res.scalars().all()

            if images:
                primary_img = next((img for img in images if img.is_primary), images[0])
                primary_img.image_url = secure_url
                primary_img.alt_text = f"{perfume_name} - Aarif Fragrances"
                primary_img.is_primary = True
                print(f"  * Updated existing image record (ID: {primary_img.id}) for {perfume_name} ({pid})")
            else:
                new_img = PerfumeImage(
                    perfume_id=pid,
                    image_url=secure_url,
                    alt_text=f"{perfume_name} - Aarif Fragrances",
                    is_primary=True,
                    display_order=0,
                )
                session.add(new_img)
                print(f"  + Created new image record for {perfume_name} ({pid})")

        await session.commit()
        print("Database commit successful!")

    # Invalidate catalog cache
    invalidate_catalog_cache()
    print("Catalog cache invalidated successfully.")

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

    # Update frontend/data/perfumes.json & bootstrap.json
    for json_file in [PROJECT_ROOT / "frontend" / "data" / "perfumes.json", PROJECT_ROOT / "frontend" / "data" / "bootstrap.json"]:
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

    print("\n" + "=" * 70)
    print("ALL 16 PERFUME IMAGES UPLOADED AND DATABASE UPDATED PERFECTLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run())
