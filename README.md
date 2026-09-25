# Aarif Fragrances — Premium E-Commerce Platform

A high-performance e-commerce platform for **Aarif Fragrances**, specializing in premium attars and perfumes with multi-size selections (6ml, 12ml, 30ml, 50ml), WhatsApp direct checkout, real-time basket calculations, and customer wishlists.

---

## 🌟 Architecture & Features

- **Frontend:** Pure HTML5, CSS3, Modern Vanilla JS with progressive hydration.
- **Backend:** FastAPI (Python 3.10+ / Async SQLAlchemy) with pooled connections.
- **Cloud Database:** Neon Serverless PostgreSQL (Pure cloud architecture).
- **Media CDN:** Cloudinary CDN with automatic dynamic transformations (`f_auto,q_auto,w_*`).
- **Caching & Speed:**
  - Instant **0ms** Client LocalStorage hydration (Stale-While-Revalidate pattern).
  - Progressive Service Worker (`sw.js`) for disk image & asset caching.
  - Sub-millisecond server-side in-memory cache with startup pre-warming.
- **Deployment Ready:**
  - **Netlify** for static frontend delivery (`netlify.toml` pre-configured).
  - **Render / Railway / Fly.io / VPS** for FastAPI backend.
  - **GitHub** repository-ready with comprehensive `.gitignore`.

---

## 📁 Project Structure

```
Aarif_Fragrances_Project/
├── app/                      # FastAPI Python Backend
│   ├── core/                 # Auth, DB setup, Cloudinary & catalog caching
│   ├── models/               # SQLAlchemy ORM models (13 tables)
│   ├── routers/              # API endpoints (catalog, cart, auth, admin)
│   ├── schemas/              # Pydantic validation schemas
│   ├── config.py             # Cloud environment settings
│   ├── database.py           # Async Neon PostgreSQL engine
│   └── main.py               # FastAPI application boot & route mounting
├── database/
│   └── schema.sql            # PostgreSQL schema definition
├── frontend/                 # Complete Storefront (Deployable to Netlify)
│   ├── assets/               # Local fallback images, logos & banners
│   ├── css/                  # Theme styles (Gold & Luxury Dark palette)
│   ├── js/                   # Storefront orchestration & shopping store
│   │   ├── data-loader.js    # SWR cache engine & API connector
│   │   ├── product-card.js   # Dynamic card generator
│   │   ├── home-sections.js  # Hero slider & auto-scroll strips
│   │   ├── shopping-store.js # Persistent cart & wishlist store
│   │   └── main.js           # Page boot & lifecycle manager
│   ├── sw.js                 # Production Service Worker
│   ├── _redirects            # Netlify routing rules
│   ├── index.html            # Homepage
│   ├── products.html         # All Perfumes catalog with filtering
│   ├── product.html          # Individual perfume details & size picker
│   ├── basket.html           # Cart checkout & WhatsApp ordering
│   ├── wishlist.html         # User favorites
│   ├── account.html          # Customer profile
│   ├── admin.html            # Store administration dashboard
│   └── 404.html              # Custom 404 error page
├── scripts/                  # Cloud migration & sync utilities
│   ├── migrate_to_neon.py    # Neon cloud database migrator
│   ├── upload_to_cloudinary.py# Cloudinary asset uploader
│   └── sync_cloud_cache.py   # Cloud cache warmup tool
├── .env.example              # Safe environment template for GitHub
├── .gitignore                # Production ignore rules (protects .env)
├── netlify.toml              # Netlify configuration & security headers
├── requirements.txt          # Python dependencies
└── run.py                    # Local server startup script
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Set Up Python Environment
```bash
git clone https://github.com/your-username/aarif-fragrances.git
cd aarif-fragrances

# Create & activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
- `DATABASE_URL`: Your Neon PostgreSQL connection string.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Your Cloudinary credentials.

### 3. Run the Application
```bash
python run.py
```
Open **http://127.0.0.1:8001** in your browser.

---

## 🌐 Deploying to Netlify

The repository is configured for one-click Netlify deployment.

### Steps:
1. Push your repository to **GitHub**.
2. Log in to [Netlify](https://app.netlify.com/) and click **"Add new site"** → **"Import an existing project"**.
3. Select your GitHub repository.
4. Netlify will automatically detect `netlify.toml`:
   - **Publish directory:** `frontend`
   - **Build command:** (leave blank — pure static frontend)
5. Click **"Deploy site"**.

### Connecting Backend API (Optional):
If your FastAPI backend is hosted on Render, Railway, Fly.io, or AWS:
- Open `netlify.toml` (or `frontend/_redirects`).
- Uncomment the redirect rule:
  ```toml
  [[redirects]]
    from = "/api/*"
    to = "https://your-backend-domain.com/api/:splat"
    status = 200
    force = true
  ```
- Re-deploy to Netlify. All `/api/*` calls will proxy transparently without CORS restrictions!

---

## ☁️ Deploying Backend (Render / Railway / VPS)

### Render (Free/Low-cost Web Service):
1. Create a **New Web Service** connected to your GitHub repository.
2. Set:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. In **Environment Variables**, add:
   - `DATABASE_URL` (Neon PostgreSQL URL)
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `APP_ENV=production`

---

## 🛡️ Security Note
Your `.env` file containing database passwords and Cloudinary secrets is listed in `.gitignore` and will never be committed to GitHub. Always configure production secrets via your hosting provider's dashboard (Netlify / Render / Railway).
