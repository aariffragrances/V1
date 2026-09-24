"""Public storefront site settings."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteSetting

DEFAULT_SITE_SETTINGS: dict[str, str] = {
    "store_name": "Aarif Fragrances",
    "store_tagline": "Premium Attar & Perfumes",
    "store_phone": "+91 9688498926",
    "whatsapp_number": "919688498926",
    "contact_email": "aariffragrances@gmail.com",
    "store_address": "Tamil Nadu, India",
    "store_city": "Tamil Nadu",
    "store_postcode": "",
    "opening_hours": "Open Daily — Mon to Sun",
    "opening_hours_mon_fri": "9:00am – 9:00pm",
    "opening_hours_saturday": "9:00am – 9:00pm",
    "opening_hours_sunday": "10:00am – 8:00pm",
    "footer_desc": (
        "Aarif Fragrances — your destination for premium attars and perfumes. "
        "Authentic, long-lasting fragrances crafted for every occasion."
    ),
    "home_about_teaser": (
        "Aarif Fragrances is a Tamil Nadu based perfume house offering a wide range of "
        "premium attars and perfumes in multiple quantities — 6ml, 12ml, 30ml and 50ml."
    ),
    "home_about_teaser_extra": (
        "From Mystic Oud and Heritage Traditional attars to Aquatic Fresh and Fruity Delights, "
        "we have the perfect fragrance for every mood and occasion."
    ),
    "about_us_text": (
        "Aarif Fragrances is a dedicated perfume and attar brand based in Tamil Nadu, India. "
        "Our collection follows eight premium fragrance families: Aquatic Fresh, Fruity Delights, "
        "Spicy & Aromatic, Mystic Oud, Floral Elegance, Rich Woody, Sweet Gourmand, and Heritage Traditional.\n\n"
        "All our perfumes are available in convenient sizes: 6ml, 12ml, 30ml, and 50ml — making "
        "them perfect for personal use, gifting, or travel.\n\n"
        "We believe that everyone deserves access to authentic, long-lasting fragrances at fair prices."
    ),
    "delivery_area": "Tamil Nadu & all over India",
    "maps_embed_url": "",
    "social_facebook": "",
    "social_instagram": "",
    "social_twitter": "",
    "store_logo_url": "",
}

SITE_SETTING_KEYS = frozenset(DEFAULT_SITE_SETTINGS.keys())


async def load_public_site_settings(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(
        select(SiteSetting).where(SiteSetting.setting_key.in_(SITE_SETTING_KEYS))
    )
    stored = {row.setting_key: row.setting_value for row in result.scalars()}
    return {**DEFAULT_SITE_SETTINGS, **stored}
