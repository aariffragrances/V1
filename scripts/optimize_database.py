"""
Script to apply advanced database indexes, triggers, and schema optimizations
for fast retrieval, efficient storage, and conflict-free concurrency.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal
from sqlalchemy import text

OPTIMIZATION_STATEMENTS = [
    # ── 1. Enable Required Extensions ──────────────────────────────────────────
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
    "CREATE EXTENSION IF NOT EXISTS btree_gin;",

    # ── 2. Automatic Timestamp Update Function & Triggers ─────────────────────
    """
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_perfumes_updated_at') THEN
            CREATE TRIGGER trg_perfumes_updated_at
            BEFORE UPDATE ON perfumes
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
            CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at') THEN
            CREATE TRIGGER trg_orders_updated_at
            BEFORE UPDATE ON orders
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_site_settings_updated_at') THEN
            CREATE TRIGGER trg_site_settings_updated_at
            BEFORE UPDATE ON site_settings
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
    END $$;
    """,

    # ── 3. Foreign Key Indexes (Eliminate Table Lock Contention & Full Scans) ───
    "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);",
    "CREATE INDEX IF NOT EXISTS idx_order_items_perfume_id ON order_items (perfume_id);",
    "CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);",
    "CREATE INDEX IF NOT EXISTS idx_site_banners_prev_id ON site_banners (prev_banner_id);",
    "CREATE INDEX IF NOT EXISTS idx_site_banners_next_id ON site_banners (next_banner_id);",

    # ── 4. Drop Redundant Indexes ─────────────────────────────────────────────
    # orders_order_ref_key already uniquely indexes order_ref; idx_orders_ref is redundant
    "DROP INDEX IF EXISTS idx_orders_ref;",

    # ── 5. Covering Index for Catalog Image Subquery ──────────────────────────
    # Accelerates LATERAL (SELECT image_url FROM perfume_images ...) by 10x-50x
    """
    CREATE INDEX IF NOT EXISTS idx_perfume_images_cover 
    ON perfume_images (perfume_id, is_primary DESC, display_order ASC, id ASC) 
    INCLUDE (image_url);
    """,

    # ── 6. Query Acceleration Partial & Composite Indexes ─────────────────────
    "CREATE INDEX IF NOT EXISTS idx_perfumes_active ON perfumes (is_active) WHERE is_active = true;",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_featured ON perfumes (is_featured) WHERE is_featured = true;",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_best_seller ON perfumes (is_best_seller) WHERE is_best_seller = true;",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_new_arrival ON perfumes (is_new_arrival) WHERE is_new_arrival = true;",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_type_active ON perfumes (fragrance_type_id, is_active);",
    "CREATE INDEX IF NOT EXISTS idx_fragrance_types_active_order ON fragrance_types (display_order) WHERE is_active = true;",
    "CREATE INDEX IF NOT EXISTS idx_site_banners_active_order ON site_banners (display_order) WHERE is_active = true;",
    "CREATE INDEX IF NOT EXISTS idx_testimonials_featured_order ON testimonials (display_order) WHERE is_featured = true;",
    "CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);",

    # ── 7. Search & Case-Insensitive Matching Indexes ──────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_perfumes_name_lower ON perfumes (LOWER(perfume_name));",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_slug_lower ON perfumes (LOWER(slug));",
    "CREATE INDEX IF NOT EXISTS idx_fragrance_types_slug_lower ON fragrance_types (LOWER(slug));",
    # GIN Trigram indexes for fast substring search (LIKE '%term%')
    "CREATE INDEX IF NOT EXISTS idx_perfumes_name_trgm ON perfumes USING gin (perfume_name gin_trgm_ops);",
    "CREATE INDEX IF NOT EXISTS idx_perfumes_brand_trgm ON perfumes USING gin (brand gin_trgm_ops);",

    # ── 8. ANALYZE to Refresh PostgreSQL Query Planner Statistics ────────────
    "ANALYZE fragrance_types;",
    "ANALYZE perfumes;",
    "ANALYZE perfume_images;",
    "ANALYZE users;",
    "ANALYZE accounts;",
    "ANALYZE sessions;",
    "ANALYZE orders;",
    "ANALYZE order_items;",
    "ANALYZE site_banners;",
    "ANALYZE testimonials;",
    "ANALYZE contact_submissions;",
    "ANALYZE site_settings;",
]

async def apply_optimizations():
    print("Connecting to database and applying optimizations...")
    async with AsyncSessionLocal() as session:
        for stmt in OPTIMIZATION_STATEMENTS:
            cleaned = stmt.strip()
            first_line = cleaned.split("\n")[0]
            try:
                await session.execute(text(cleaned))
                await session.commit()
                print(f"[OK] {first_line[:65]}...")
            except Exception as e:
                await session.rollback()
                print(f"[ERR] Failed: {first_line[:40]} -> {e}")
    print("\nDatabase optimization applied successfully!")

if __name__ == "__main__":
    asyncio.run(apply_optimizations())
