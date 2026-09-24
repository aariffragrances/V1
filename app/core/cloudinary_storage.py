"""Cloudinary image upload helpers."""

from __future__ import annotations

import io
import re
import uuid
from pathlib import Path

from app.config import get_settings

MAX_UPLOAD_BYTES = 9_500_000
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def configure_cloudinary():
    import cloudinary
    settings = get_settings()
    if not settings.cloudinary_configured:
        raise RuntimeError("Cloudinary is not configured — set CLOUDINARY_* in .env")
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def public_id_from_url(url: str) -> str | None:
    if "res.cloudinary.com" not in url:
        return None
    match = re.search(r"/upload/(?:v\d+/)?(.+)$", url)
    if not match:
        return None
    return match.group(1).rsplit(".", 1)[0]


def upload_upload_file(data: bytes, filename: str, *, subfolder: str) -> dict:
    import cloudinary.uploader
    from PIL import Image
    settings = get_settings()
    ext = Path(filename).suffix.lower() or ".jpg"
    if ext not in IMAGE_EXTS:
        raise ValueError(f"Unsupported file type: {ext}")
    public_id = f"{Path(filename).stem}_{uuid.uuid4().hex[:8]}"
    folder = f"{settings.cloudinary_folder}/{subfolder}"
    configure_cloudinary()
    if len(data) > MAX_UPLOAD_BYTES:
        img = Image.open(io.BytesIO(data))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()
    return cloudinary.uploader.upload(data, folder=folder, public_id=public_id, overwrite=True)


def delete_by_url(url: str) -> None:
    import cloudinary.uploader
    public_id = public_id_from_url(url)
    if not public_id:
        return
    configure_cloudinary()
    cloudinary.uploader.destroy(public_id, resource_type="image")
