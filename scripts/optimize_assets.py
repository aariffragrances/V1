"""
optimize_assets.py — Compress local images with PIL for snappy local delivery.
"""
from PIL import Image
from pathlib import Path
import io

assets_dir = Path("frontend/assets")

for p in sorted(assets_dir.rglob("*.*")):
    if p.suffix.lower() in {".png", ".jpg", ".jpeg"} and not p.name.startswith("."):
        sz_before = p.stat().st_size
        with open(p, "rb") as f:
            data = f.read()
        im = Image.open(io.BytesIO(data))
        w, h = im.size
        resized = False
        
        # Resize oversized graphics
        if "types" in p.parts:
            if w > 480 or h > 480:
                im = im.resize((480, 480), Image.Resampling.LANCZOS)
                resized = True
        elif "product-types" in p.parts:
            if w > 400 or h > 400:
                im = im.resize((400, 400), Image.Resampling.LANCZOS)
                resized = True
        elif "banners" in p.parts:
            if w > 1400:
                new_h = int(h * (1400 / w))
                im = im.resize((1400, new_h), Image.Resampling.LANCZOS)
                resized = True
        elif "products" in p.parts or p.name.startswith("bottle"):
            if w > 600:
                new_h = int(h * (600 / w))
                im = im.resize((600, new_h), Image.Resampling.LANCZOS)
                resized = True

        buf = io.BytesIO()
        im.save(buf, format=im.format or "PNG", optimize=True)
        new_data = buf.getvalue()
        
        if len(new_data) < sz_before:
            with open(p, "wb") as f:
                f.write(new_data)
            print(f"Compressed {p.relative_to(assets_dir)}: {sz_before/1024:.1f} KB -> {len(new_data)/1024:.1f} KB")
        else:
            print(f"Kept {p.relative_to(assets_dir)} ({sz_before/1024:.1f} KB)")

print("Asset optimization complete.")
