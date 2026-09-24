-- =============================================================================
-- Aarif Fragrances PostgreSQL Production Schema
-- Optimized for high-concurrency retrieval, low-latency search, and data integrity
-- =============================================================================

-- ── 1. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ── 2. Automatic Timestamp Update Trigger Function ───────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Fragrance Catalog Tables ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fragrance_types (
    type_id         VARCHAR(10) PRIMARY KEY,
    type_name       VARCHAR(100) NOT NULL,
    description     TEXT,
    slug            VARCHAR(120) UNIQUE NOT NULL,
    icon_image_url  TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    display_order   SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

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
    is_car_hanger       BOOLEAN DEFAULT FALSE,
    is_featured         BOOLEAN DEFAULT FALSE,
    is_best_seller      BOOLEAN DEFAULT FALSE,
    is_new_arrival      BOOLEAN DEFAULT FALSE,
    stock_quantity      INTEGER DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perfume_images (
    id              SERIAL PRIMARY KEY,
    perfume_id      VARCHAR(25) NOT NULL REFERENCES perfumes(perfume_id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    alt_text        VARCHAR(255),
    is_primary      BOOLEAN DEFAULT FALSE,
    display_order   SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Customer & Admin Auth Tables ──────────────────────────────────────────
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
);

CREATE TABLE IF NOT EXISTS accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                    VARCHAR(20) NOT NULL,
    provider                VARCHAR(50) NOT NULL,
    provider_account_id     VARCHAR(255) NOT NULL,
    access_token            TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token   TEXT UNIQUE NOT NULL,
    expires         TIMESTAMPTZ NOT NULL
);

-- ── 5. Orders & WhatsApp Checkout Tables ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    order_ref        VARCHAR(32) NOT NULL UNIQUE,
    status           VARCHAR(20) NOT NULL DEFAULT 'new',
    customer_note    TEXT,
    whatsapp_message TEXT,
    total_units      INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    perfume_id   VARCHAR(25),
    perfume_name VARCHAR(255) NOT NULL,
    size         VARCHAR(20),
    qty          INTEGER NOT NULL DEFAULT 1,
    price        NUMERIC(10,2)
);

-- ── 6. Site Content & Settings Tables ────────────────────────────────────────
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
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    subscribed_at   TIMESTAMPTZ DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS contact_submissions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    enquiry_type    VARCHAR(100),
    message         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
    setting_key     VARCHAR(100) PRIMARY KEY,
    setting_value   TEXT NOT NULL,
    setting_type    VARCHAR(20),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Performance & Query Acceleration Indexes ──────────────────────────────
-- Foreign Key Indexes (eliminates table locks and full scans on joins/cascades)
CREATE INDEX IF NOT EXISTS idx_perfumes_type ON perfumes(fragrance_type_id);
CREATE INDEX IF NOT EXISTS idx_perfumes_type_active ON perfumes (fragrance_type_id, is_active);
CREATE INDEX IF NOT EXISTS idx_perfume_images_perfume ON perfume_images(perfume_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_perfume_id ON order_items (perfume_id);
CREATE INDEX IF NOT EXISTS idx_site_banners_prev_id ON site_banners (prev_banner_id);
CREATE INDEX IF NOT EXISTS idx_site_banners_next_id ON site_banners (next_banner_id);

-- Covering Index for LATERAL Subquery in catalog queries
CREATE INDEX IF NOT EXISTS idx_perfume_images_cover 
ON perfume_images (perfume_id, is_primary DESC, display_order ASC, id ASC) 
INCLUDE (image_url);

-- Partial Indexes for High-Frequency Catalog Filters
CREATE INDEX IF NOT EXISTS idx_perfumes_active ON perfumes (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_perfumes_featured ON perfumes (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_perfumes_best_seller ON perfumes (is_best_seller) WHERE is_best_seller = true;
CREATE INDEX IF NOT EXISTS idx_perfumes_new_arrival ON perfumes (is_new_arrival) WHERE is_new_arrival = true;
CREATE INDEX IF NOT EXISTS idx_fragrance_types_active_order ON fragrance_types (display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_site_banners_active_order ON site_banners (display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_testimonials_featured_order ON testimonials (display_order) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submitted ON contact_submissions (submitted_at DESC);

-- Case-Insensitive Lookup & Trigram Full-Text Search Indexes
CREATE INDEX IF NOT EXISTS idx_perfumes_name_lower ON perfumes (LOWER(perfume_name));
CREATE INDEX IF NOT EXISTS idx_perfumes_slug_lower ON perfumes (LOWER(slug));
CREATE INDEX IF NOT EXISTS idx_fragrance_types_slug_lower ON fragrance_types (LOWER(slug));
CREATE INDEX IF NOT EXISTS idx_perfumes_name_trgm ON perfumes USING gin (perfume_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_perfumes_brand_trgm ON perfumes USING gin (brand gin_trgm_ops);

-- ── 8. Triggers for Automatic Updated-At Timestamps ──────────────────────────
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
