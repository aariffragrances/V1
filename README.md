# Aarif Fragrances - Premium Perfume E-commerce Platform

## About
Aarif Fragrances is a perfume vendor website for selling premium attars and perfumes in multiple quantities (6ml, 12ml, 30ml, 50ml).

**Business Details:**
- Name: Aarif Fragrances
- Location: Tamil Nadu, India
- Contact: +91 9688498926
- Email: aariffragrances@gmail.com

## Tech Stack
- **Backend:** FastAPI (Python 3.10+)
- **Database:** PostgreSQL (Aarif_fragnances)
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Image Storage:** Cloudinary (optional)
- **Styling:** Custom CSS with Gold/Luxury theme

## Project Structure
```
Aarif_Fragrances_Project/
├── app/                 # FastAPI backend
│   ├── core/            # Seed, auth, catalog helpers
│   ├── models/          # SQLAlchemy models
│   ├── routers/         # API routes
│   ├── schemas/         # Pydantic schemas
│   ├── config.py
│   ├── database.py
│   └── main.py
├── database/
│   └── schema.sql
├── frontend/            # Static site (served by FastAPI)
│   ├── assets/
│   │   ├── banners/     # Hero banners
│   │   ├── types/       # Category card images
│   │   ├── aarif-logo.png
│   │   └── bottle.png
│   ├── css/
│   ├── js/
│   └── *.html
├── images/              # Source image library (canonical names)
│   ├── banners/
│   ├── brand/
│   ├── categories/      # One image per fragrance type
│   └── products/
├── scripts/
│   └── create_database.py
├── run.py
├── requirements.txt
└── .env
```

**Category image filenames** (under `images/categories/` and `frontend/assets/types/`):

| File | Fragrance type |
|------|----------------|
| `aquatic-fresh.png` | Aquatic Fresh |
| `fruity-delights.png` | Fruity Delights |
| `spicy-aromatic.png` | Spicy & Aromatic |
| `mystic-oud.png` | Mystic Oud |
| `floral-elegance.png` | Floral Elegance |
| `rich-woody.png` | Rich Woody |
| `sweet-gourmand.png` | Sweet Gourmand |
| `heritage-traditional.png` | Heritage Traditional |

## Database Setup

### 1. Create Database
```bash
psql -U postgres
CREATE DATABASE Aarif_fragnances;
\c Aarif_fragnances
```

### 2. Database Schema
The schema includes:
- **fragrance_types**: Perfume categories (Fresh/Aquatic, Fruity, Floral, Oud, Woody, Gourmand, Spicy/Oriental, Aromatic, Traditional)
- **perfumes**: All perfume products with prices for 6ml, 12ml, 30ml, 50ml
- **perfume_images**: Product images
- **users**: Customer and admin accounts
- **site_banners**: Homepage banners
- **testimonials**: Customer reviews
- **contact_submissions**: Contact form messages
- **newsletter_subscribers**: Email subscriptions

The schema auto-creates on first run via `app/core/db_setup.py`.

## Setup Instructions

### 1. Python Environment
```bash
cd "E:\AARIF FRAGNANCES\Aarif_Fragrances_Project"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Configuration
The `.env` file is already configured with:
- Database: `Aarif_fragnances` (postgres:2003)
- Default admin credentials will be created on first run

### 3. Run the Application
```bash
# Make sure PostgreSQL is running
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The application will:
1. Create all database tables
2. Seed 9 fragrance types
3. Seed ~52 perfumes from your data
4. Create default admin user (admin@aarifragrances.local / Admin@1234)

### 4. Access the Application
- **Website:** http://127.0.0.1:8000
- **Admin Panel:** http://127.0.0.1:8000/admin
- **API Docs:** http://127.0.0.1:8000/docs

## Default Admin Login
- **Email:** admin@aarifragrances.local
- **Password:** Admin@1234

## Perfume Data Seeded

### Fragrance Types:
1. Fresh / Aquatic (9 perfumes)
2. Fruity (8 perfumes)
3. Floral (6 perfumes)
4. Oud (7 perfumes)
5. Woody (5 perfumes)
6. Gourmand (5 perfumes)
7. Spicy / Oriental (4 perfumes)
8. Aromatic (5 perfumes)
9. Traditional (3 attars)

### Sample Perfumes:
- Bvlgari Aqua: 30ml (₹150), 50ml (₹300)
- Hawas: 30ml (₹200), 50ml (₹400)
- White Oud: 30ml (₹200), 50ml (₹400)
- Khamrah: 30ml (₹250), 50ml (₹500)
- Jannat Firdaus (Attar): 6ml (₹200), 12ml (₹400)
- And many more...

## Frontend Development Status

### ✅ Completed (Backend):
- Complete FastAPI backend
- All database models
- Authentication (login/register)
- Catalog API (perfumes, fragrance types)
- Admin API (manage perfumes, testimonials, banners, etc.)
- Contact form API
- Newsletter API
- WhatsApp integration ready

### ⏳ To Complete (Frontend):
The following frontend files need to be copied/adapted from the supermarket project:

**HTML Pages** (adapt branding to "Aarif Fragrances"):
- index.html
- products.html
- basket.html
- about.html
- contact.html
- login.html
- signup.html
- account.html
- admin.html

**JavaScript Files** (adapt from supermarket):
- data-loader.js
- shopping-store.js
- basket.js
- product-card.js
- filters.js
- customer-auth.js
- navigation.js
- And others...

**CSS Files**:
- main.css (started, needs completion)
- admin.css

## Customization Notes

### From Supermarket to Perfume Shop:
1. Replace "GMS World Foods" → "Aarif Fragrances"
2. Replace "categories/subcategories" → "fragrance types"
3. Replace "products" → "perfumes"
4. Add quantity selector: 6ml, 12ml, 30ml, 50ml
5. Replace phone: 01895476737 → +91 9688498926
6. Replace WhatsApp: 441895476737 → 919688498926
7. Update color scheme to Gold/Luxury theme
8. Replace location: West Drayton → Tamil Nadu, India

### Key Changes Made:
- Database schema for perfumes with 4 price points
- Fragrance type taxonomy instead of categories
- Indian contact details
- INR pricing (₹)
- Default phone country: IN (India)

## Next Steps

1. **Copy Frontend Files**: Copy HTML/JS/CSS from supermarket project
2. **Adapt Branding**: Search/replace company names and details
3. **Update API Calls**: Change endpoint names (products → perfumes, categories → fragrance-types)
4. **Add Quantity Selector**: Modify product cards to show 4 size options
5. **Test**: Verify all pages work correctly
6. **Add Images**: Upload perfume images via admin panel
7. **Customize Theme**: Apply gold/luxury color palette

## API Endpoints

### Public Catalog:
- `GET /api/v1/catalog/bootstrap` - All data in one call
- `GET /api/v1/catalog/perfumes-bulk` - All perfumes
- `GET /api/v1/fragrance-types` - All fragrance types
- `GET /api/v1/perfumes` - Paginated perfumes
- `GET /api/v1/perfumes/{id}` - Single perfume

### Admin (requires authentication):
- `GET /api/v1/admin/stats` - Dashboard stats
- `GET /api/v1/admin/perfumes` - Manage perfumes
- `POST /api/v1/admin/perfumes` - Create perfume
- `PUT /api/v1/admin/perfumes/{id}` - Update perfume
- `POST /api/v1/admin/perfumes/{id}/images/upload` - Upload images
- And many more...

## Production Deployment

1. Update `.env`:
   - Set `APP_ENV=production`
   - Change `SECRET_KEY` to a strong random value
   - Update `CORS_ORIGINS` with production domain

2. Configure Cloudinary (optional):
   - Set CLOUDINARY_* variables for image uploads

3. Use production PostgreSQL server

4. Run with production ASGI server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Support

For questions or issues:
- Email: aariffragrances@gmail.com
- Phone: +91 9688498926

---

**Project Status**: Backend complete, frontend templates ready to adapt.
**Last Updated**: July 23, 2026
