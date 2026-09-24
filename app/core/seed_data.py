"""Canonical perfume catalog - matches Aarif Fragrances menu card.

Sizing rules (both types available on every perfume):
  - Attar: 6ml + 12ml
  - Perfume: 30ml + 50ml
"""

from __future__ import annotations


def _round10(value: float) -> int:
    return max(50, int(round(value / 10.0) * 10))


def _fill_sizes(
    low: int,
    high: int,
    *,
    base: str = "perfume",
) -> tuple[int | None, int | None, int | None, int | None]:
    """Return (price_6ml, price_12ml, price_30ml, price_50ml).

    base='perfume' → low/high are 30ml/50ml; attar prices are derived
    base='attar'   → low/high are 6ml/12ml; perfume prices are derived
    """
    if base == "attar":
        p6, p12 = low, high
        p30 = _round10(high * 2.0)
        p50 = _round10(high * 3.5)
    else:
        p30, p50 = low, high
        p6 = _round10(low * 0.5)
        p12 = _round10(high * 0.5)
    return p6, p12, p30, p50


FRAGRANCE_TYPES = [
    ("FT001", "Aquatic Fresh", "aquatic-fresh", "Cool aquatic & fresh breezes", 1),
    ("FT002", "Fruity Delights", "fruity-delights", "Bright fruity accords", 2),
    ("FT003", "Spicy & Aromatic", "spicy-aromatic", "Spicy, aromatic & bold blends", 3),
    ("FT004", "Mystic Oud", "mystic-oud", "Rich oud compositions", 4),
    ("FT005", "Floral Elegance", "floral-elegance", "Soft floral bouquets", 5),
    ("FT006", "Rich Woody", "rich-woody", "Warm woody bases", 6),
    ("FT007", "Sweet Gourmand", "sweet-gourmand", "Sweet dessert-inspired scents", 7),
    ("FT008", "Heritage Traditional", "heritage-traditional", "Classic attars & heritage blends", 8),
]

RETIRED_PERFUME_IDS = ("PF003", "PF007", "PF033")
# Legacy duplicates from an older attar/perfume split:
#   PF003 Invictus → keep PF005
#   PF007 Iceberg  → keep PF009
#   PF033 Jasmine  → keep PF019

# Descriptions used on product detail cards
DESCRIPTIONS: dict[str, str] = {
    # Aquatic Fresh
    "PF001": (
        "A refined aquatic fragrance with sparkling citrus, marine seaweed, soft lavender, and woody amber, "
        "delivering a clean, cool, and sophisticated oceanic scent perfect for warm weather."
    ),
    "PF002": (
        "A classic fresh aromatic scent with mint, seawater, lavender, and woody musk, offering a sharp, "
        "clean, and invigorating character ideal for everyday summer wear."
    ),
    "PF005": (
        "A bold woody-aquatic fragrance with zesty grapefruit, marine notes, bay leaf, and ambergris, "
        "creating an energetic, confident, and sporty scent with strong projection."
    ),
    "PF006": (
        "A smooth woody-floral musk with sea notes, bergamot, melon, lavender, and sandalwood, "
        "delivering a clean, powdery, and elegant freshness suitable for day and evening."
    ),
    "PF004": (
        "A vibrant fruity-aquatic scent with juicy apple, citrus, cinnamon, watery notes, and ambergris, "
        "offering a sweet, addictive, and long-lasting fragrance perfect for hot weather."
    ),
    "PF008": (
        "A light feminine aquatic-floral with juicy pear, soft pink peony, and clean musk, "
        "creating a delicate, romantic, and refreshing scent ideal for daytime wear."
    ),
    "PF009": (
        "A crisp aromatic-aquatic fragrance with bright citrus, green notes, marine accords, and woody moss, "
        "delivering pure icy freshness perfect for everyday summer use."
    ),
    # Fruity Delights
    "PF010": (
        "A bright and juicy fruity scent centered on crisp green apple with light citrus and soft musk, "
        "offering a clean, youthful, and energizing fragrance for daytime."
    ),
    "PF011": (
        "A tropical fruity fragrance bursting with ripe pineapple and sunny sweetness, "
        "delivering a fun, vibrant, and refreshing character ideal for warm weather."
    ),
    "PF012": (
        "A sweet and playful fruity scent built around ripe strawberry with soft creaminess and musk, "
        "creating a cheerful, feminine, and youthful everyday fragrance."
    ),
    "PF013": (
        "A fresh and slightly tart fruity fragrance focused on juicy blueberry with soft musk, "
        "offering a light, modern, and refreshing scent for spring and summer."
    ),
    "PF014": (
        "A delicate exotic fruity scent featuring juicy lychee with soft floral and clean musk notes, "
        "delivering an elegant, tropical, and feminine daytime fragrance."
    ),
    "PF015": (
        "A vibrant fruity-floral with dark berries, citrus, violet, jasmine, and creamy vanilla-musk, "
        "creating a bold, modern, and addictive scent for day or night."
    ),
    "PF016": (
        "An iconic fruity-woody fragrance with pineapple, bergamot, birch, and oakmoss, "
        "delivering a confident, sophisticated, and powerful scent perfect for special occasions."
    ),
    "PF017": (
        "A dark and mysterious fruity scent with deep red berries, subtle spice, and warm woods, "
        "offering a bold, dramatic, and seductive fragrance ideal for evenings."
    ),
    # Spicy & Aromatic
    "PF041": (
        "A dark luxurious oriental with black truffle, orchid, dark fruits, chocolate, and incense, "
        "creating a mysterious, opulent, and highly seductive evening scent."
    ),
    "PF042": (
        "A modern aromatic-woody fragrance with spicy notes, rich woods, subtle sweetness, and warm amber, "
        "delivering a smooth, masculine, mysterious scent with excellent projection — perfect for evenings and cooler weather."
    ),
    "PF043": (
        "A bold spicy-woody scent with blood mandarin, cinnamon, leather, and amber, "
        "offering a warm, flashy, and attention-grabbing fragrance ideal for nightlife."
    ),
    "PF044": (
        "A rich traditional aromatic with warm spices, florals, and deep woody-amber notes, "
        "creating a smooth, nocturnal, and opulent scent perfect for evening wear."
    ),
    "PF045": (
        "A modern aromatic-woody fragrance with fresh spicy notes and smooth masculine woods, "
        "delivering an energetic, sporty, and confident character for everyday wear."
    ),
    "PF046": (
        "A classic aromatic fougère with lavender, citrus, geranium, oakmoss, and tonka, "
        "offering a traditional, masculine, and timeless scent for everyday use."
    ),
    "PF047": (
        "A luxurious leather fragrance with raspberry, saffron, jasmine, and rich suede, "
        "creating a raw yet refined, sensual, and sophisticated scent for cooler evenings."
    ),
    "PF048": (
        "A warm opulent oriental with tobacco leaf, vanilla, cacao, and dried fruits, "
        "delivering a sweet, spicy, and comforting fragrance perfect for cold weather."
    ),
    "PF049": (
        "A fresh spicy-woody scent with bergamot, pepper, ambroxan, and cedar, "
        "offering a bold, versatile, and highly magnetic fragrance suitable for any occasion."
    ),
    # Mystic Oud
    "PF024": (
        "A clean and elegant oud fragrance softened with light florals and musk, "
        "delivering a refined, wearable, and sophisticated oriental scent for day or night."
    ),
    "PF025": (
        "A sweet warm oud blended with golden honey and amber, "
        "creating a smooth, resinous, and luxurious fragrance ideal for cooler weather and evenings."
    ),
    "PF026": (
        "A rich mysterious oud with dark fruity and spicy accents, "
        "offering a bold, opulent, and seductive oriental scent perfect for special occasions."
    ),
    "PF027": (
        "A warm resinous blend of deep oud and golden amber, "
        "delivering a smooth, glowing, and long-lasting luxurious scent ideal for evening wear."
    ),
    "PF028": (
        "A regal powerful oud fragrance with rich woods and spices, "
        "creating a bold, traditional, and commanding scent perfect for formal occasions."
    ),
    "PF029": (
        "A sweet gourmand-oud with rich caramel, vanilla, and smooth woods, "
        "offering a warm, edible, and unique luxurious fragrance for cooler weather."
    ),
    "PF030": (
        "A modern high-impact oud with spices, woods, and incense, "
        "delivering a bold, sophisticated, and long-lasting scent designed to make a strong impression."
    ),
    # Floral Elegance
    "PF018": (
        "A classic light floral with soft feminine notes and clean powderiness, "
        "offering a fresh, approachable, and timeless scent ideal for everyday wear."
    ),
    "PF019": (
        "A pure elegant floral centered on rich creamy jasmine with soft musk, "
        "creating a romantic, feminine, and sophisticated fragrance for day or evening."
    ),
    "PF020": (
        "A modern floral with peony, citrus, rose, and soft woods, "
        "delivering a fresh, stylish, and feminine scent perfect for daytime wear."
    ),
    "PF021": (
        "A soft romantic floral with gentle white flowers and clean musk, "
        "offering a light, feminine, and approachable fragrance ideal for everyday use."
    ),
    "PF022": (
        "A delicate elegant floral with soft blooms and subtle sweetness, "
        "creating a graceful, refined, and feminine scent suitable for daytime occasions."
    ),
    "PF023": (
        "A graceful romantic floral with soft elegant notes and clean dry-down, "
        "delivering a gentle, feminine, and versatile fragrance for everyday wear."
    ),
    # Rich Woody
    "PF031": (
        "A smooth creamy woody fragrance centered on rich sandalwood with soft warmth, "
        "offering an elegant, calming, and versatile scent for any occasion."
    ),
    "PF032": (
        "A rich natural woody scent with earthy and slightly green undertones, "
        "delivering a fresh yet deep fragrance ideal for daytime and cooler weather."
    ),
    "PF034": (
        "A dark masculine woody fragrance with deep woods, spice, and smooth amber, "
        "creating a bold, confident, and evening-ready scent."
    ),
    "PF035": (
        "A modern woody fragrance with rich woods, amber, and soft musk, "
        "offering an attractive, long-lasting, and magnetic scent with strong presence."
    ),
    # Sweet Gourmand
    "PF036": (
        "A rich edible gourmand centered on dark chocolate with vanilla and soft spices, "
        "delivering an indulgent, comforting scent perfect for cooler weather."
    ),
    "PF037": (
        "A warm creamy gourmand built on rich vanilla bean with soft woods and musk, "
        "offering a smooth, comforting, and versatile fragrance for any season."
    ),
    "PF038": (
        "A cozy edible gourmand with warm vanilla, buttery notes, and soft spices, "
        "creating a comforting, nostalgic, and sweet scent ideal for cold weather."
    ),
    "PF039": (
        "A rich spicy-sweet gourmand with cinnamon, dates, praline, and vanilla, "
        "delivering a warm, boozy, and highly addictive fragrance perfect for evenings."
    ),
    "PF040": (
        "A seductive coffee-gourmand with black coffee, white flowers, and vanilla, "
        "offering a sweet, addictive, and bold scent ideal for nightlife."
    ),
    # Heritage Traditional
    "PF050": (
        "A classic traditional attar with rich florals, woods, and soft oriental sweetness, "
        "delivering an elegant, spiritual, and timeless scent for special occasions."
    ),
    "PF051": (
        "A traditional multi-floral woody attar with complex blooms and oriental depth, "
        "creating a rich, classic, and culturally rooted fragrance for formal wear."
    ),
    "PF052": (
        "A pure powerful musk fragrance with clean animalic depth and soft intimacy, "
        "offering a classic, elegant, and highly personal scent for everyday or special use."
    ),
}

# (perfume_id, type_id, name, price_base, low, high, featured, best_seller, new_arrival)
# price_base: perfume -> low/high are 30/50; attar -> low/high are 6/12
# Every perfume offers BOTH Attar (6/12) and Perfume (30/50)
_RAW_PERFUMES = [
    ("PF001", "FT001", "Bvlgari Aqua", "perfume", 150, 300, True, True, False),
    ("PF002", "FT001", "Cool Water", "perfume", 150, 300, True, False, False),
    ("PF005", "FT001", "Invictus", "perfume", 100, 200, False, False, True),
    ("PF006", "FT001", "Royal Blue", "perfume", 200, 400, True, True, False),
    ("PF004", "FT001", "Hawas Rasasi", "perfume", 200, 400, True, True, False),
    ("PF008", "FT001", "Sea Rose", "perfume", 150, 300, False, False, True),
    ("PF009", "FT001", "Iceberg", "perfume", 100, 200, False, False, False),
    ("PF010", "FT002", "Green Apple", "perfume", 150, 300, True, False, False),
    ("PF011", "FT002", "Pine Apple", "perfume", 100, 200, False, False, False),
    ("PF012", "FT002", "Strawberry", "perfume", 100, 200, False, False, True),
    ("PF013", "FT002", "Blue Berry", "perfume", 100, 200, False, False, False),
    ("PF014", "FT002", "Litchi", "perfume", 100, 200, False, False, False),
    ("PF015", "FT002", "Burberry Her", "perfume", 200, 400, True, True, False),
    ("PF016", "FT002", "Creed Aventus", "perfume", 100, 100, True, True, False),
    ("PF017", "FT002", "Vampire Blood", "perfume", 200, 400, False, False, True),
    ("PF041", "FT003", "Black Orchid", "perfume", 250, 500, True, True, False),
    ("PF042", "FT003", "Azzaro Black", "perfume", 150, 300, False, False, False),
    ("PF043", "FT003", "1 Million", "perfume", 150, 300, True, True, False),
    ("PF044", "FT003", "Jawad Al Lail", "perfume", 100, 200, False, False, False),
    ("PF045", "FT003", "CR7", "perfume", 200, 400, True, False, False),
    ("PF046", "FT003", "Brut", "perfume", 200, 400, False, False, False),
    ("PF047", "FT003", "Tuscan Leather", "perfume", 200, 400, True, False, False),
    ("PF048", "FT003", "Tobacco Vanilla", "perfume", 200, 400, True, True, False),
    ("PF049", "FT003", "Savage Dior", "perfume", 200, 400, True, True, True),
    ("PF024", "FT004", "White Oud", "perfume", 200, 400, True, True, False),
    ("PF025", "FT004", "Honey Oud", "perfume", 200, 400, True, False, False),
    ("PF026", "FT004", "Purple Oud", "perfume", 200, 400, True, False, False),
    ("PF027", "FT004", "Amber Oud", "perfume", 200, 400, True, True, False),
    ("PF028", "FT004", "Ameer Al Oud", "perfume", 200, 400, True, True, False),
    ("PF029", "FT004", "Caramel Oud", "perfume", 200, 400, True, False, True),
    ("PF030", "FT004", "Oud for Greatness", "perfume", 200, 400, True, True, False),
    ("PF018", "FT005", "Charlie", "perfume", 100, 200, False, False, False),
    ("PF019", "FT005", "Jasmine", "perfume", 100, 200, True, False, False),
    ("PF020", "FT005", "Gucci Flora", "perfume", 200, 400, True, True, False),
    ("PF021", "FT005", "Lovely", "perfume", 200, 400, False, False, False),
    ("PF022", "FT005", "Sabaya", "perfume", 150, 300, False, False, False),
    ("PF023", "FT005", "Shanaya", "perfume", 200, 400, False, False, True),
    ("PF031", "FT006", "Sandal", "perfume", 100, 200, False, False, False),
    ("PF032", "FT006", "Hudson Valley", "perfume", 300, 600, True, True, False),
    ("PF034", "FT006", "Jaguar Black", "perfume", 200, 400, False, False, False),
    ("PF035", "FT006", "Magnet", "perfume", 100, 200, False, False, True),
    ("PF036", "FT007", "Chocolate", "perfume", 100, 200, False, False, False),
    ("PF037", "FT007", "Vanilla", "perfume", 100, 200, False, False, False),
    ("PF038", "FT007", "Biscuit", "perfume", 100, 200, False, False, False),
    ("PF039", "FT007", "Khamrah", "perfume", 250, 500, True, True, False),
    ("PF040", "FT007", "Black Opium", "perfume", 200, 400, True, True, False),
    ("PF050", "FT008", "Jannat Firdaus", "attar", 200, 400, True, True, False),
    ("PF051", "FT008", "Majmua", "attar", 100, 200, False, False, False),
    ("PF052", "FT008", "Musk Rijali", "attar", 250, 500, True, True, False),
]


def perfume_seed_rows() -> list[dict]:
    rows = []
    for pid, ftype, name, price_base, low, high, featured, best, new in _RAW_PERFUMES:
        p6, p12, p30, p50 = _fill_sizes(low, high, base=price_base)
        slug = (
            name.lower()
            .replace(" ", "-")
            .replace("/", "-")
            .replace("'", "")
            + "-"
            + pid.lower()
        )
        rows.append(
            {
                "perfume_id": pid,
                "fragrance_type_id": ftype,
                "perfume_name": name,
                "slug": slug,
                "description": DESCRIPTIONS.get(pid, f"Premium {name} fragrance from Aarif Fragrances."),
                "is_attar": True,
                "is_perfume": True,
                "is_car_hanger": True,
                "price_6ml": p6,
                "price_12ml": p12,
                "price_30ml": p30,
                "price_50ml": p50,
                "is_featured": featured,
                "is_best_seller": best,
                "is_new_arrival": new,
            }
        )
    return rows


TESTIMONIALS = [
    ("Priya S.", "P", 5, "The White Oud is absolutely stunning - long lasting and elegant. Ordered 30ml and already planning to get 50ml!", 1),
    ("Mohammed A.", "M", 5, "Best attar shop in Tamil Nadu. Jannat Firdaus fragrance is pure quality. WhatsApp ordering was so easy.", 2),
    ("Anitha R.", "A", 5, "Loved Hawas Rasasi and Royal Blue. Sizes are perfect for travel. Will definitely order again.", 3),
    ("Karthik V.", "K", 5, "Ameer Al Oud smells premium. Fair prices and quick delivery. Highly recommended!", 4),
]
