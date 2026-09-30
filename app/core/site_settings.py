"""Public storefront site settings."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import _cache_get, _cache_set
from app.models import SiteSetting

DEFAULT_SITE_SETTINGS: dict[str, str] = {
    "store_name": "Aarif Fragrances",
    "store_tagline": "Premium Attar & Perfumes",
    "store_phone": "+91 9688498926",
    "whatsapp_number": "919688498926",
    "contact_email": "aariffragrances@gmail.com",
    "store_address": "Main Road, Opp. Commando Fitness Center",
    "store_city": "Uthangudi, Madurai, Tamil Nadu – 625107",
    "store_postcode": "625107",
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
    "home_stat_1_val": "49+",
    "home_stat_1_lbl": "Fragrances",
    "home_stat_2_val": "8",
    "home_stat_2_lbl": "Fragrance Types",
    "home_stat_3_val": "4",
    "home_stat_3_lbl": "Size Options",
    "home_stat_4_val": "TN",
    "home_stat_4_lbl": "Tamil Nadu, India",
    # Containers (Section titles and subtitles)
    "container_featured_title": "Featured Perfumes",
    "container_featured_subtitle": "Our handpicked selection of finest fragrances",
    "container_bestsellers_title": "Best Sellers",
    "container_bestsellers_subtitle": "The most loved fragrances by our customers",
    # How to order section
    "order_section_title": "How to Order",
    "order_section_subtitle": "From scent to doorstep — simple, personal, and made for Aarif Fragrances",
    "order_step_1_title": "1. Choose Your Scent",
    "order_step_1_subtitle": "Browse attars & perfumes — Attar or Perfume, in the size that suits you",
    "order_step_2_title": "2. Build Your Cart",
    "order_step_2_subtitle": "Select 6ml, 12ml, 30ml or 50ml and add your favourite fragrances",
    "order_step_3_title": "3. WhatsApp Checkout",
    "order_step_3_subtitle": "Share your cart on WhatsApp — no online payment needed",
    "order_step_4_title": "4. We Deliver",
    "order_step_4_subtitle": "We confirm your order and deliver across Tamil Nadu & India",
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
    cached = _cache_get("public_site_settings")
    if cached is not None:
        return cached

    result = await db.execute(
        select(SiteSetting).where(SiteSetting.setting_key.in_(SITE_SETTING_KEYS))
    )
    stored = {row.setting_key: row.setting_value for row in result.scalars()}
    merged = {**DEFAULT_SITE_SETTINGS, **stored}
    _cache_set("public_site_settings", merged)
    return merged
