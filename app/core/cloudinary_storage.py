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


def upload_file_path(path: Path | str, *, folder: str, public_id: str | None = None, overwrite: bool = True) -> dict:
    import cloudinary.uploader
    from PIL import Image
    settings = get_settings()
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"Image file not found: {p}")
    ext = p.suffix.lower()
    if ext not in IMAGE_EXTS:
        raise ValueError(f"Unsupported file type: {ext}")
    
    configure_cloudinary()
    pid = public_id or p.stem
    target_folder = f"{settings.cloudinary_folder}/{folder}".strip("/") if not folder.startswith(settings.cloudinary_folder) else folder

    data = p.read_bytes()
    if len(data) > MAX_UPLOAD_BYTES:
        img = Image.open(io.BytesIO(data))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()

    return cloudinary.uploader.upload(
        data,
        folder=target_folder,
        public_id=pid,
        overwrite=overwrite,
        resource_type="image",
    )


def get_optimized_url(url: str, *, width: int | None = None, height: int | None = None, crop: str = "fill") -> str:
    """Inject Cloudinary on-the-fly transformations (f_auto,q_auto) for faster web delivery."""
    if not url or "res.cloudinary.com" not in url or "/upload/" not in url:
        return url
    transforms = ["f_auto", "q_auto"]
    if width:
        transforms.append(f"w_{width}")
    if height:
        transforms.append(f"h_{height}")
        transforms.append(f"c_{crop}")
    trans_str = ",".join(transforms)
    if f"/upload/{trans_str}/" in url or "/upload/f_auto,q_auto/" in url:
        return url
    return url.replace("/upload/", f"/upload/{trans_str}/", 1)
