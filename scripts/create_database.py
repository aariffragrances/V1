"""
create_database.py
------------------
Creates the PostgreSQL database 'Aarif_fragnances' and all tables,
then seeds fragrance types + perfume products.

Run once:
    python create_database.py
"""

import asyncio
import sys

# ── Read .env manually (no dependency on app config) ────────────────────────
import os
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

DB_HOST     = os.environ.get("DB_HOST", "localhost")
DB_PORT     = int(os.environ.get("DB_PORT", "5432"))
DB_NAME     = os.environ.get("DB_NAME", "Aarif_fragnances")
DB_USER     = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "2003")

# ── Step 1: Create the database if it doesn't exist ─────────────────────────
def create_database_if_missing():
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        # psycopg2 not installed — try with asyncpg raw connection later
        print("[INFO] psycopg2 not found; will attempt direct DB creation via asyncpg.")
        return False

    print(f"[1/4] Connecting to PostgreSQL as '{DB_USER}' on {DB_HOST}:{DB_PORT} ...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASSWORD,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'")
        exists = cur.fetchone()
        if exists:
            print(f"[1/4] Database '{DB_NAME}' already exists — skipping creation.")
        else:
            cur.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"[1/4] Database '{DB_NAME}' created successfully.")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[ERROR] Could not connect to postgres: {e}")
        print("       Make sure PostgreSQL is running and credentials are correct in .env")
        sys.exit(1)


async def create_database_asyncpg():
    """Fallback: create DB using asyncpg connecting to 'postgres' maintenance DB."""
    try:
        import asyncpg
    except ImportError:
        print("[ERROR] asyncpg not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    print(f"[1/4] Connecting via asyncpg to create database '{DB_NAME}' ...")
    try:
        conn = await asyncpg.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASSWORD,
            database="postgres"
        )
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", DB_NAME
        )
        if exists:
            print(f"[1/4] Database '{DB_NAME}' already exists — skipping creation.")
        else:
            await conn.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"[1/4] Database '{DB_NAME}' created successfully.")
        await conn.close()
    except Exception as e:
        print(f"[ERROR] Could not create database: {e}")
        print("       Make sure PostgreSQL is running and credentials are correct in .env")
        sys.exit(1)


# ── Step 2 – 4: Create tables + seed data using the app's async engine ──────
async def setup_schema_and_seed():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

    db_url = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    print(f"[2/4] Connecting to '{DB_NAME}' and creating tables ...")
    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        # pgcrypto for UUID generation
        await conn.execute(__import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS fragrance_types (
                type_id         VARCHAR(10) PRIMARY KEY,
                type_name       VARCHAR(100) NOT NULL,
                description     TEXT,
                slug            VARCHAR(120) UNIQUE NOT NULL,
                icon_image_url  TEXT,
                is_active       BOOLEAN DEFAULT TRUE,
                display_order   SMALLINT DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS perfumes (
                perfume_id          VARCHAR(25) PRIMARY KEY,
                fragrance_type_id   VARCHAR(10) NOT NULL REFERENCES fragrance_types(type_id),
                perfume_name        VARCHAR(255) NOT NULL,
                brand               VARCHAR(100),
                slug                VARCHAR(300) UNIQUE NOT NULL,
                description         TEXT,
                price_6ml           NUMERIC(10,2),
                price_12ml          NUMERIC(10,2),
                price_30ml          NUMERIC(10,2),
                price_50ml          NUMERIC(10,2),
                is_attar            BOOLEAN DEFAULT FALSE,
                is_perfume          BOOLEAN DEFAULT TRUE,
                is_featured         BOOLEAN DEFAULT FALSE,
                is_best_seller      BOOLEAN DEFAULT FALSE,
                is_new_arrival      BOOLEAN DEFAULT FALSE,
                stock_quantity      INTEGER DEFAULT 0,
                is_active           BOOLEAN DEFAULT TRUE,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS perfume_images (
                id              SERIAL PRIMARY KEY,
                perfume_id      VARCHAR(25) NOT NULL REFERENCES perfumes(perfume_id) ON DELETE CASCADE,
                image_url       TEXT NOT NULL,
                alt_text        VARCHAR(255),
                is_primary      BOOLEAN DEFAULT FALSE,
                display_order   SMALLINT DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS users (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name            VARCHAR(100),
                username        VARCHAR(50) UNIQUE,
                email           VARCHAR(255) UNIQUE NOT NULL,
                phone           VARCHAR(30) UNIQUE,
                phone_country   VARCHAR(5) DEFAULT 'IN',
                address         TEXT,
                email_verified  TIMESTAMPTZ,
                role            VARCHAR(20) DEFAULT 'customer',
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS accounts (
                id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type                    VARCHAR(20) NOT NULL,
                provider                VARCHAR(50) NOT NULL,
                provider_account_id     VARCHAR(255) NOT NULL,
                access_token            TEXT,
                created_at              TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(provider, provider_account_id)
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS sessions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_token   TEXT UNIQUE NOT NULL,
                expires         TIMESTAMPTZ NOT NULL
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS testimonials (
                id                      SERIAL PRIMARY KEY,
                customer_name           VARCHAR(100) NOT NULL,
                customer_initial        VARCHAR(5),
                is_verified_customer    BOOLEAN DEFAULT TRUE,
                rating                  SMALLINT DEFAULT 5,
                quote                   TEXT NOT NULL,
                is_featured             BOOLEAN DEFAULT TRUE,
                display_order           SMALLINT DEFAULT 0,
                created_at              TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id              SERIAL PRIMARY KEY,
                email           VARCHAR(255) UNIQUE NOT NULL,
                is_active       BOOLEAN DEFAULT TRUE,
                subscribed_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS site_banners (
                id              SERIAL PRIMARY KEY,
                title           VARCHAR(150) NOT NULL,
                subtitle        VARCHAR(255),
                image_url       TEXT NOT NULL,
                link_url        TEXT,
                is_active       BOOLEAN DEFAULT TRUE,
                display_order   SMALLINT DEFAULT 0,
                prev_banner_id  INTEGER REFERENCES site_banners(id) ON DELETE SET NULL,
                next_banner_id  INTEGER REFERENCES site_banners(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS contact_submissions (
                id              SERIAL PRIMARY KEY,
                name            VARCHAR(150) NOT NULL,
                email           VARCHAR(255) NOT NULL,
                phone           VARCHAR(30),
                enquiry_type    VARCHAR(100),
                message         TEXT NOT NULL,
                is_read         BOOLEAN DEFAULT FALSE,
                submitted_at    TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        await conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key     VARCHAR(100) PRIMARY KEY,
                setting_value   TEXT NOT NULL,
                setting_type    VARCHAR(20),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))

    print("[2/4] All tables created successfully.")

    # ── Seed via shared app helpers ──────────────────────────────────────────
    print("[3/4] Seeding fragrance types, perfumes, testimonials, admin ...")
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Ensure project root is on path for `app.*` imports
    sys.path.insert(0, str(Path(__file__).parent))

    from app.core.db_setup import (
        ensure_admin_account,
        seed_fragrance_types,
        seed_perfumes,
        seed_testimonials,
    )

    async with async_session() as db:
        await seed_fragrance_types(db)
        await seed_perfumes(db)
        await seed_testimonials(db)
        await ensure_admin_account(db)
        print("       Admin : admin@aarifragrances.local / Admin@1234")

    await engine.dispose()
    print("[3/4] Seeding complete.")

async def main():
    print("=" * 55)
    print("  Aarif Fragrances — Database Setup")
    print("=" * 55)

    # Try psycopg2 first, then asyncpg fallback
    used_sync = create_database_if_missing()
    if not used_sync:
        await create_database_asyncpg()

    await setup_schema_and_seed()

    print("[4/4] Database setup finished successfully!")
    print("=" * 55)
    print("  You can now run:  python run.py")
    print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())
