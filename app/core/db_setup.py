"""Database setup: ensure all tables exist and seed default admin."""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("aarif")


async def _run_statements(db: AsyncSession, statements: list[str], label: str, *, strict: bool = False) -> None:
    for stmt in statements:
        try:
            await db.execute(text(stmt))
        except Exception as exc:
            if strict:
                await db.rollback()
                raise
            logger.warning("%s setup skipped: %s", label, exc)
    await db.commit()


async def ensure_schema(db: AsyncSession) -> None:
    """Ensure all required tables and columns exist."""
    await _run_statements(
        db,
        [
            "CREATE EXTENSION IF NOT EXISTS pgcrypto",
            """
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
            """,
            """
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
            """,
            "CREATE INDEX IF NOT EXISTS idx_perfumes_type ON perfumes(fragrance_type_id)",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_featured ON perfumes(is_featured) WHERE is_featured",
            "ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS perfume_spray BOOLEAN DEFAULT TRUE",
            "ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS is_perfume BOOLEAN DEFAULT TRUE",
            "ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS is_car_hanger BOOLEAN DEFAULT FALSE",
            """
            DO $$ BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'perfumes' AND column_name = 'is_car_hangover'
              ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'perfumes' AND column_name = 'is_car_hanger'
              ) THEN
                UPDATE perfumes SET is_car_hanger = COALESCE(is_car_hangover, FALSE)
                  WHERE is_car_hanger IS DISTINCT FROM COALESCE(is_car_hangover, FALSE);
                ALTER TABLE perfumes DROP COLUMN IF EXISTS is_car_hangover;
              ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'perfumes' AND column_name = 'is_car_hangover'
              ) THEN
                ALTER TABLE perfumes RENAME COLUMN is_car_hangover TO is_car_hanger;
              END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'perfumes' AND column_name = 'perfume_spray'
              ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'perfumes' AND column_name = 'is_perfume'
              ) THEN
                ALTER TABLE perfumes RENAME COLUMN perfume_spray TO is_perfume;
              ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'perfumes' AND column_name = 'perfume_spray'
              ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'perfumes' AND column_name = 'is_perfume'
              ) THEN
                UPDATE perfumes SET is_perfume = COALESCE(is_perfume, perfume_spray, TRUE);
                ALTER TABLE perfumes DROP COLUMN perfume_spray;
              END IF;
            END $$;
            """,
            "ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS description TEXT",
            """
            CREATE TABLE IF NOT EXISTS perfume_images (
                id              SERIAL PRIMARY KEY,
                perfume_id      VARCHAR(25) NOT NULL REFERENCES perfumes(perfume_id) ON DELETE CASCADE,
                image_url       TEXT NOT NULL,
                alt_text        VARCHAR(255),
                is_primary      BOOLEAN DEFAULT FALSE,
                display_order   SMALLINT DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_perfume_images_perfume ON perfume_images(perfume_id)",
            """
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
            """,
            """
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
            """,
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_token   TEXT UNIQUE NOT NULL,
                expires         TIMESTAMPTZ NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS testimonials (
                id                      SERIAL PRIMARY KEY,
                customer_name           VARCHAR(100) NOT NULL,
                customer_initial        VARCHAR(5),
                is_verified_customer    BOOLEAN DEFAULT TRUE,
                rating                  SMALLINT DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
                quote                   TEXT NOT NULL,
                is_featured             BOOLEAN DEFAULT TRUE,
                display_order           SMALLINT DEFAULT 0,
                created_at              TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id              SERIAL PRIMARY KEY,
                email           VARCHAR(255) UNIQUE NOT NULL,
                is_active       BOOLEAN DEFAULT TRUE,
                subscribed_at   TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            """
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
            """,
            """
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
            """,
            "CREATE INDEX IF NOT EXISTS idx_contact_submitted ON contact_submissions (submitted_at DESC)",
            """
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key     VARCHAR(100) PRIMARY KEY,
                setting_value   TEXT NOT NULL,
                setting_type    VARCHAR(20),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS orders (
                id               SERIAL PRIMARY KEY,
                order_ref        VARCHAR(32) NOT NULL UNIQUE,
                status           VARCHAR(20) NOT NULL DEFAULT 'new',
                customer_note    TEXT,
                whatsapp_message TEXT,
                total_units      INTEGER NOT NULL DEFAULT 0,
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                updated_at       TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)",
            """
            CREATE TABLE IF NOT EXISTS order_items (
                id           SERIAL PRIMARY KEY,
                order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                perfume_id   VARCHAR(20),
                perfume_name VARCHAR(255) NOT NULL,
                size         VARCHAR(20),
                qty          INTEGER NOT NULL DEFAULT 1,
                price        NUMERIC(10,2)
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id)",
            "CREATE EXTENSION IF NOT EXISTS pg_trgm",
            "CREATE EXTENSION IF NOT EXISTS btree_gin",
            "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires)",
            "CREATE INDEX IF NOT EXISTS idx_order_items_perfume_id ON order_items (perfume_id)",
            "CREATE INDEX IF NOT EXISTS idx_site_banners_prev_id ON site_banners (prev_banner_id)",
            "CREATE INDEX IF NOT EXISTS idx_site_banners_next_id ON site_banners (next_banner_id)",
            "DROP INDEX IF EXISTS idx_orders_ref",
            """
            CREATE INDEX IF NOT EXISTS idx_perfume_images_cover 
            ON perfume_images (perfume_id, is_primary DESC, display_order ASC, id ASC) 
            INCLUDE (image_url)
            """,
            "CREATE INDEX IF NOT EXISTS idx_perfumes_active ON perfumes (is_active) WHERE is_active = true",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_featured ON perfumes (is_featured) WHERE is_featured = true",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_best_seller ON perfumes (is_best_seller) WHERE is_best_seller = true",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_new_arrival ON perfumes (is_new_arrival) WHERE is_new_arrival = true",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_type_active ON perfumes (fragrance_type_id, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_fragrance_types_active_order ON fragrance_types (display_order) WHERE is_active = true",
            "CREATE INDEX IF NOT EXISTS idx_site_banners_active_order ON site_banners (display_order) WHERE is_active = true",
            "CREATE INDEX IF NOT EXISTS idx_testimonials_featured_order ON testimonials (display_order) WHERE is_featured = true",
            "CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_name_lower ON perfumes (LOWER(perfume_name))",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_slug_lower ON perfumes (LOWER(slug))",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_name_trgm ON perfumes USING gin (perfume_name gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_perfumes_brand_trgm ON perfumes USING gin (brand gin_trgm_ops)",
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
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
                    CREATE TRIGGER trg_users_updated_at
                    BEFORE UPDATE ON users
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at') THEN
                    CREATE TRIGGER trg_orders_updated_at
                    BEFORE UPDATE ON orders
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_site_settings_updated_at') THEN
                    CREATE TRIGGER trg_site_settings_updated_at
                    BEFORE UPDATE ON site_settings
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                END IF;
            END $$;
            """,
        ],
        "Schema setup",
        strict=True,
    )


async def ensure_admin_account(db: AsyncSession) -> None:
    """Create default admin user if not exists."""
    from app.core.auth import hash_password
    import uuid, asyncio

    result = await db.execute(
        text("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    )
    if result.scalar_one_or_none():
        return

    admin_id = str(uuid.uuid4())
    password_hash = await asyncio.to_thread(hash_password, "Admin@1234")

    await _run_statements(
        db,
        [
            f"""
            INSERT INTO users (id, name, username, email, role)
            VALUES ('{admin_id}', 'Admin', 'admin', 'admin@aarifragrances.local', 'admin')
            ON CONFLICT DO NOTHING
            """,
            f"""
            INSERT INTO accounts (user_id, type, provider, provider_account_id, access_token)
            VALUES ('{admin_id}', 'email', 'credentials', 'admin@aarifragrances.local', '{password_hash}')
            ON CONFLICT DO NOTHING
            """,
        ],
        "Admin account",
    )
    logger.info("Default admin created. Email: admin@aarifragrances.local  Password: Admin@1234")


async def seed_fragrance_types(db: AsyncSession) -> None:
    """Upsert fragrance types from the menu card (8 categories)."""
    from app.core.seed_data import FRAGRANCE_TYPES

    for type_id, type_name, slug, description, order in FRAGRANCE_TYPES:
        icon_url = f"/assets/types/{slug}.png"
        exists = (
            await db.execute(
                text("SELECT 1 FROM fragrance_types WHERE type_id = :id"),
                {"id": type_id},
            )
        ).scalar_one_or_none()
        if exists:
            await db.execute(
                text(
                    """
                    UPDATE fragrance_types SET
                        type_name = :name,
                        slug = :slug,
                        description = :desc,
                        display_order = :order,
                        icon_image_url = CASE 
                            WHEN icon_image_url LIKE '%res.cloudinary.com%' THEN icon_image_url 
                            ELSE :icon 
                        END,
                        is_active = TRUE
                    WHERE type_id = :id
                    """
                ),
                {
                    "id": type_id,
                    "name": type_name,
                    "slug": slug,
                    "desc": description,
                    "order": order,
                    "icon": icon_url,
                },
            )
        else:
            await db.execute(
                text(
                    "INSERT INTO fragrance_types "
                    "(type_id, type_name, slug, description, icon_image_url, display_order, is_active) "
                    "VALUES (:id, :name, :slug, :desc, :icon, :order, TRUE)"
                ),
                {
                    "id": type_id,
                    "name": type_name,
                    "slug": slug,
                    "desc": description,
                    "icon": icon_url,
                    "order": order,
                },
            )

    # Deactivate obsolete 9th category if present
    await db.execute(
        text("UPDATE fragrance_types SET is_active = FALSE WHERE type_id = 'FT009'")
    )
    await db.commit()
    logger.info("Fragrance types synced to menu card (%d types).", len(FRAGRANCE_TYPES))


async def seed_perfumes(db: AsyncSession) -> None:
    """Insert/update menu-card perfumes; deactivate retired products."""
    from app.core.seed_data import perfume_seed_rows, RETIRED_PERFUME_IDS

    rows = perfume_seed_rows()
    for row in rows:
        exists = (
            await db.execute(
                text("SELECT 1 FROM perfumes WHERE perfume_id = :perfume_id"),
                {"perfume_id": row["perfume_id"]},
            )
        ).scalar_one_or_none()
        if exists:
            await db.execute(
                text(
                    """
                    UPDATE perfumes SET
                        fragrance_type_id = :fragrance_type_id,
                        perfume_name = :perfume_name,
                        slug = :slug,
                        description = :description,
                        is_attar = :is_attar,
                        is_perfume = :is_perfume,
                        is_car_hanger = :is_car_hanger,
                        price_6ml = :price_6ml,
                        price_12ml = :price_12ml,
                        price_30ml = :price_30ml,
                        price_50ml = :price_50ml,
                        is_featured = :is_featured,
                        is_best_seller = :is_best_seller,
                        is_new_arrival = :is_new_arrival,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE perfume_id = :perfume_id
                    """
                ),
                row,
            )
        else:
            await db.execute(
                text(
                    """
                    INSERT INTO perfumes (
                        perfume_id, fragrance_type_id, perfume_name, slug, description,
                        is_attar, is_perfume, is_car_hanger,
                        price_6ml, price_12ml, price_30ml, price_50ml,
                        is_featured, is_best_seller, is_new_arrival,
                        is_active, stock_quantity
                    ) VALUES (
                        :perfume_id, :fragrance_type_id, :perfume_name, :slug, :description,
                        :is_attar, :is_perfume, :is_car_hanger,
                        :price_6ml, :price_12ml, :price_30ml, :price_50ml,
                        :is_featured, :is_best_seller, :is_new_arrival,
                        TRUE, 100
                    )
                    """
                ),
                row,
            )

    for rid in RETIRED_PERFUME_IDS:
        # Remove legacy duplicate SKUs entirely (old attar/perfume split rows).
        await db.execute(
            text("DELETE FROM perfume_images WHERE perfume_id = :id"),
            {"id": rid},
        )
        await db.execute(
            text("DELETE FROM perfumes WHERE perfume_id = :id"),
            {"id": rid},
        )
    await db.commit()
    logger.info("Perfumes synced to menu card (%d active).", len(rows))


async def seed_testimonials(db: AsyncSession) -> None:
    """Seed homepage testimonials if table is empty."""
    from app.core.seed_data import TESTIMONIALS

    result = await db.execute(text("SELECT COUNT(*) FROM testimonials"))
    if result.scalar_one() > 0:
        return

    for name, initial, rating, quote, order in TESTIMONIALS:
        await db.execute(
            text(
                """
                INSERT INTO testimonials
                    (customer_name, customer_initial, rating, quote, is_featured, display_order)
                VALUES (:name, :initial, :rating, :quote, TRUE, :order)
                """
            ),
            {"name": name, "initial": initial, "rating": rating, "quote": quote, "order": order},
        )
    await db.commit()
    logger.info("Testimonials seeded.")


async def seed_banners(db: AsyncSession) -> None:
    """Seed / sync hero banner slides from frontend assets."""
    banners = [
        ("Banner 01", "/assets/banners/banner-01.png", "products.html", 0),
        ("Banner 02", "/assets/banners/banner-02.png", "products.html", 1),
        ("Banner 03", "/assets/banners/banner-03.png", "products.html", 2),
        ("Banner 04", "/assets/banners/banner-04.png", "products.html", 3),
        ("Banner 05", "/assets/banners/banner-05.png", "products.html", 4),
        ("Spicy & Aromatic", "/assets/banners/banner-spicy-aromatic.png", "products.html?type=FT003", 5),
        ("Aquatic Fresh", "/assets/banners/banner-aquatic-fresh.png", "products.html?type=FT001", 6),
        ("Fruity Delights", "/assets/banners/banner-fruity-delights.png", "products.html?type=FT002", 7),
    ]

    for title, image_url, link_url, order in banners:
        fname = image_url.split('/')[-1]
        exists = (
            await db.execute(
                text("SELECT id FROM site_banners WHERE image_url = :url OR image_url LIKE :like_url LIMIT 1"),
                {"url": image_url, "like_url": f"%{fname}%"},
            )
        ).scalar_one_or_none()
        if exists:
            await db.execute(
                text(
                    """
                    UPDATE site_banners
                    SET title = :title, subtitle = '', link_url = :link_url,
                        is_active = TRUE, display_order = :order
                    WHERE id = :id
                    """
                ),
                {"id": exists, "title": title, "link_url": link_url, "order": order},
            )
        else:
            await db.execute(
                text(
                    """
                    INSERT INTO site_banners (title, subtitle, image_url, link_url, is_active, display_order)
                    VALUES (:title, '', :image_url, :link_url, TRUE, :order)
                    """
                ),
                {
                    "title": title,
                    "image_url": image_url,
                    "link_url": link_url,
                    "order": order,
                },
            )

    # Migrate legacy banner paths to the renamed files
    await db.execute(
        text(
            """
            UPDATE site_banners
            SET image_url = '/assets/banners/banner-aquatic-fresh.png'
            WHERE image_url IN ('/assets/banners/banner-aquatic.png', '/assets/banners/aquatic.png')
            """
        )
    )
    await db.execute(
        text(
            """
            UPDATE site_banners
            SET image_url = '/assets/banners/banner-fruity-delights.png'
            WHERE image_url IN (
                '/assets/banners/banner-fruit.png',
                '/assets/banners/fruit.png',
                '/assets/banners/fruity-delights.png'
            )
            """
        )
    )
    await db.execute(
        text(
            """
            UPDATE site_banners
            SET image_url = '/assets/banners/banner-spicy-aromatic.png'
            WHERE image_url LIKE '%spixy%' OR image_url LIKE '%spicy and aromatic%'
            """
        )
    )
    await db.commit()
    logger.info("Hero banners synced (%d slides).", len(banners))
