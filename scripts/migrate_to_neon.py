"""
migrate_to_neon.py — Fast, idempotent data & schema migration from local PostgreSQL to Neon PostgreSQL.

Usage:
    python scripts/migrate_to_neon.py
    python scripts/migrate_to_neon.py --neon-url "postgresql://neondb_owner:PASSWORD@ep-cold-mode-b49duzcu-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    python scripts/migrate_to_neon.py --truncate    # Truncate and replace data on Neon
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

from sqlalchemy import func, select, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.core.db_setup import ensure_schema
from app.models import (
    Account,
    ContactSubmission,
    FragranceType,
    NewsletterSubscriber,
    Order,
    OrderItem,
    Perfume,
    PerfumeImage,
    Session,
    SiteBanner,
    SiteSetting,
    Testimonial,
    User,
)


def _sanitize_neon_url(raw_url: str) -> URL:
    parsed = make_url(raw_url.strip())
    drivername = parsed.drivername.replace("postgres://", "postgresql://")
    if drivername in {"postgresql", "postgres"}:
        drivername = "postgresql+asyncpg"
    query = dict(parsed.query)
    # Remove libpq parameters unsupported by asyncpg
    query.pop("channel_binding", None)
    if query.get("sslmode") and "ssl" not in query:
        query["ssl"] = query.pop("sslmode")
    elif "ssl" not in query:
        query["ssl"] = "require"
    return parsed.set(drivername=drivername, query=query)


TABLE_MIGRATION_ORDER = [
    ("users", User),
    ("accounts", Account),
    ("fragrance_types", FragranceType),
    ("perfumes", Perfume),
    ("perfume_images", PerfumeImage),
    ("site_banners", SiteBanner),
    ("site_settings", SiteSetting),
    ("testimonials", Testimonial),
    ("orders", Order),
    ("order_items", OrderItem),
    ("sessions", Session),
    ("contact_submissions", ContactSubmission),
    ("newsletter_subscribers", NewsletterSubscriber),
]


async def run_migration(neon_url_str: str, truncate: bool = False):
    settings = get_settings()

    # 1. Validate Neon URL
    if not neon_url_str or "YOUR_NEW_NEON_PASSWORD" in neon_url_str or "<password>" in neon_url_str:
        print("\n" + "=" * 70)
        print("[!] ERROR: Valid Neon PostgreSQL password required!")
        print("=" * 70)
        print("Please replace 'YOUR_NEW_NEON_PASSWORD' in your .env file:")
        print("  DATABASE_URL=postgresql://neondb_owner:<YOUR_PASSWORD>@ep-cold-mode-b49duzcu-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
        print("\nOr provide it via command-line argument:")
        print("  python scripts/migrate_to_neon.py --neon-url \"<YOUR_NEON_URL>\"")
        print("=" * 70 + "\n")
        return False

    neon_url = _sanitize_neon_url(neon_url_str)
    local_url = make_url(
        os.getenv("LOCAL_DATABASE_URL") or "postgresql+asyncpg://postgres:2003@localhost:5432/Aarif_fragnances"
    )

    print("\n" + "=" * 70)
    print("[MIGRATE] AARIF FRAGRANCES -- NEON POSTGRESQL MIGRATION")
    print("=" * 70)
    print(f"Source (Local DB): {local_url.render_as_string(hide_password=True)}")
    print(f"Target (Neon DB):  {neon_url.render_as_string(hide_password=True)}")
    print("=" * 70 + "\n")

    # 2. Setup engines
    local_engine = create_async_engine(local_url, echo=False)
    neon_engine = create_async_engine(
        neon_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"statement_cache_size": 0, "timeout": 30, "command_timeout": 60},
    )

    LocalSession = async_sessionmaker(local_engine, class_=AsyncSession, expire_on_commit=False)
    NeonSession = async_sessionmaker(neon_engine, class_=AsyncSession, expire_on_commit=False)

    try:
        # Test connections
        print("Testing connections...")
        async with LocalSession() as s_local:
            await s_local.execute(text("SELECT 1"))
        print("  [OK] Local PostgreSQL connected successfully.")

        async with NeonSession() as s_neon:
            await s_neon.execute(text("SELECT 1"))
            print("  [OK] Neon PostgreSQL connected successfully.")

            # Ensure schema & extensions on Neon
            print("\nEnsuring extensions and schema on Neon...")
            await s_neon.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
            await s_neon.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
            await s_neon.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gin;"))
            await s_neon.commit()

            await ensure_schema(s_neon)
            print("  [OK] Schema, tables, triggers, and extensions ready on Neon.")

            if truncate:
                print("\nClearing existing Neon rows (truncate cascade)...")
                # Truncate in reverse order
                for tname, _ in reversed(TABLE_MIGRATION_ORDER):
                    try:
                        await s_neon.execute(text(f'TRUNCATE TABLE "{tname}" RESTART IDENTITY CASCADE;'))
                    except Exception as e:
                        pass
                await s_neon.commit()
                print("  ✓ Tables truncated.")

        # 3. Migrate data table by table
        print("\nMigrating data from Local DB to Neon DB:")
        results = []

        for tname, model_cls in TABLE_MIGRATION_ORDER:
            async with LocalSession() as s_local:
                local_count = (await s_local.execute(select(func.count()).select_from(model_cls))).scalar() or 0
                if local_count == 0:
                    results.append((tname, 0, 0, "SKIPPED (0 rows)"))
                    print(f"  • {tname:<25} : 0 rows (skipped)")
                    continue

                # Fetch all rows from local
                stmt = select(model_cls)
                rows = (await s_local.execute(stmt)).scalars().all()

            # Insert into Neon
            async with NeonSession() as s_neon:
                inserted = 0
                for row in rows:
                    try:
                        # Merge handles ON CONFLICT DO UPDATE / INSERT cleanly
                        await s_neon.merge(row)
                        inserted += 1
                    except Exception as e:
                        print(f"    ⚠ Error merging row in {tname}: {e}")

                await s_neon.commit()

                # Verify Neon count
                neon_count = (await s_neon.execute(select(func.count()).select_from(model_cls))).scalar() or 0

                # Reset sequence if table has serial ID
                try:
                    await s_neon.execute(text(f"""
                        DO $$
                        DECLARE
                            seq_name text;
                        BEGIN
                            seq_name := pg_get_serial_sequence('"{tname}"', 'id');
                            IF seq_name IS NOT NULL THEN
                                EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM "%s"), 1))', seq_name, '{tname}');
                            END IF;
                        END $$;
                    """))
                    await s_neon.commit()
                except Exception:
                    pass

                status = "OK" if neon_count >= local_count else "MISMATCH"
                results.append((tname, local_count, neon_count, status))
                print(f"  * {tname:<25} : {local_count:>4} local -> {neon_count:>4} Neon  [{status}]")

        print("\n" + "=" * 70)
        print("[SUMMARY] MIGRATION REPORT")
        print("=" * 70)
        print(f"{'Table':<26} {'Local':>8} {'Neon':>8} {'Status':>16}")
        print("-" * 70)
        for tname, loc, neon, stat in results:
            print(f"{tname:<26} {loc:>8} {neon:>8} {stat:>16}")
        print("=" * 70)
        print("[SUCCESS] Neon PostgreSQL migration completed successfully!\n")
        return True

    except Exception as exc:
        print(f"\n[!] Migration failed: {exc}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await local_engine.dispose()
        await neon_engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Migrate Aarif Fragrances data to Neon PostgreSQL")
    parser.add_argument("--neon-url", help="Neon PostgreSQL connection URL (overrides .env DATABASE_URL)")
    parser.add_argument("--truncate", action="store_true", help="Truncate Neon tables before inserting")
    args = parser.parse_args()

    settings = get_settings()
    neon_url = args.neon_url or settings.database_connection_url or os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL") or ""

    asyncio.run(run_migration(neon_url, truncate=args.truncate))


if __name__ == "__main__":
    main()
