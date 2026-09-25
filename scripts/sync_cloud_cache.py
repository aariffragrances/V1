import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import text
from app.database import AsyncSessionLocal
from scripts.upload_to_cloudinary import upload_and_sync
from app.config import get_settings

async def main():
    async with AsyncSessionLocal() as session:
        # 1. Clean local path banners
        await session.execute(text("DELETE FROM site_banners WHERE image_url NOT LIKE '%cloudinary%'"))
        await session.commit()
    print("Old local banner entries pruned.")

    # 2. Run upload and sync with transformation parameters
    s = get_settings()
    await upload_and_sync(s.cloudinary_cloud_name, s.cloudinary_api_key, s.cloudinary_api_secret)

if __name__ == "__main__":
    asyncio.run(main())
