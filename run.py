"""
run.py
------
Starts the Aarif Fragrances web server.

Usage:
    python run.py
"""

import os
import sys
from pathlib import Path

# ── Load .env ────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

HOST   = os.environ.get("HOST") or os.environ.get("APP_HOST") or ("0.0.0.0" if (os.environ.get("PORT") or os.environ.get("RENDER")) else "127.0.0.1")
PORT   = int(os.environ.get("PORT") or os.environ.get("APP_PORT") or "8001")
RELOAD = os.environ.get("APP_ENV", "development").lower() != "production" and not os.environ.get("RENDER")

# ── Check uvicorn is installed ───────────────────────────────────────────────
try:
    import uvicorn
except ImportError:
    print("[ERROR] uvicorn is not installed.")
    print("        Run:  pip install -r requirements.txt")
    sys.exit(1)

# ── REQUIRED on Windows: guard multiprocessing entry point ──────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  Aarif Fragrances Server")
    print("=" * 55)
    print(f"  URL  : http://{HOST}:{PORT}")
    print(f"  Admin: http://{HOST}:{PORT}/admin")
    print(f"  Docs : http://{HOST}:{PORT}/docs")
    print(f"  Mode : {'development (auto-reload)' if RELOAD else 'production'}")
    print("  Stop : Ctrl + C")
    print("=" * 55)

    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        log_level="info",
    )
