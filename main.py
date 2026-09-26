"""Root entrypoint for Aarif Fragrances FastAPI application on Vercel and ASGI runners."""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app  # noqa: F401
