from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.password_policy import validate_password_strength


class FragranceTypeOut(BaseModel):
    type_id: str
    type_name: str
    description: str | None = None
    icon_image_url: str | None = None
    display_order: int = 0
    product_count: int = 0


class PerfumeOut(BaseModel):
    perfumeId: str
    fragranceTypeId: str
    fragranceTypeName: str
    perfumeName: str
    displayName: str
    brand: str = ""
    description: str = ""
    price6ml: float | None = None
    price12ml: float | None = None
    price30ml: float | None = None
    price50ml: float | None = None
    isAttar: bool = False
    isPerfume: bool = False
    isCarHanger: bool = False
    isFeatured: bool = False
    isBestSeller: bool = False
    isNewArrival: bool = False
    primaryImageUrl: str | None = None


class PerfumeListResponse(BaseModel):
    items: list[PerfumeOut]
    total_count: int
    total_pages: int
    current_page: int
    per_page: int


class BannerOut(BaseModel):
    id: int
    title: str
    subtitle: str | None = None
    image_url: str
    link_url: str | None = None
    display_order: int


class TestimonialOut(BaseModel):
    initials: str
    name: str
    text: str
    rating: int = 5


class NewsletterSubscribeIn(BaseModel):
    email: EmailStr


class CatalogMetadataOut(BaseModel):
    fragranceTypes: list[dict]
    siteSettings: dict[str, str] = {}
    promotionBanners: list[dict] = []


class CatalogProductsBulkOut(BaseModel):
    perfumes: list[dict]


class BootstrapOut(BaseModel):
    fragranceTypes: list[dict]
    perfumes: list[dict]
    promotionBanners: list[dict] = []
    siteSettings: dict[str, str] = {}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone_country: str = Field(default="IN", min_length=2, max_length=5)
    phone: str = Field(min_length=7, max_length=30)
    address: str = Field(min_length=3, max_length=500)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("phone_country")
    @classmethod
    def normalize_country(cls, value: str) -> str:
        return (value or "IN").strip().upper()


class LoginIn(BaseModel):
    login: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class CustomerProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone_country: str | None = Field(default=None, min_length=2, max_length=5)
    phone: str | None = Field(default=None, min_length=7, max_length=30)
    address: str | None = Field(default=None, min_length=3, max_length=500)

    @field_validator("phone_country")
    @classmethod
    def normalize_country(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().upper()


class UserProfileOut(BaseModel):
    id: str
    name: str | None = None
    username: str | None = None
    email: str
    phone: str | None = None
    phone_country: str | None = None
    address: str | None = None
    role: str


class AuthOut(BaseModel):
    session_token: str
    user: UserProfileOut


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AdminFragranceTypeIn(StrictBaseModel):
    type_id: str | None = Field(default=None, max_length=10)
    type_name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    slug: str | None = Field(default=None, max_length=120)
    icon_image_url: str | None = None
    is_active: bool | None = None
    display_order: int | None = Field(default=None, ge=0, le=32767)


class AdminPerfumeIn(StrictBaseModel):
    perfume_id: str | None = Field(default=None, max_length=25)
    fragrance_type_id: str | None = Field(default=None, max_length=10)
    perfume_name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    price_6ml: float | None = Field(default=None, ge=0)
    price_12ml: float | None = Field(default=None, ge=0)
    price_30ml: float | None = Field(default=None, ge=0)
    price_50ml: float | None = Field(default=None, ge=0)
    is_attar: bool | None = None
    is_perfume: bool | None = None
    is_car_hanger: bool | None = None
    is_featured: bool | None = None
    is_best_seller: bool | None = None
    is_new_arrival: bool | None = None
    is_active: bool | None = None
    stock_quantity: int | None = Field(default=None, ge=0)


class AdminPerfumeImageIn(StrictBaseModel):
    image_url: str | None = None
    imageUrl: str | None = None
    is_primary: bool | None = None
    alt_text: str | None = Field(default=None, max_length=255)
    display_order: int | None = Field(default=None, ge=0, le=32767)


class AdminBannerIn(StrictBaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    subtitle: str | None = Field(default=None, max_length=255)
    image_url: str | None = None
    link_url: str | None = None
    display_order: int | None = Field(default=None, ge=0, le=32767)
    is_active: bool | None = None


class AdminTestimonialIn(StrictBaseModel):
    customer_name: str | None = Field(default=None, min_length=1, max_length=100)
    customer_initial: str | None = Field(default=None, max_length=5)
    rating: int | None = Field(default=None, ge=1, le=5)
    quote: str | None = Field(default=None, min_length=1, max_length=5000)
    is_featured: bool | None = None
    display_order: int | None = Field(default=None, ge=0, le=32767)


class AdminNewsletterCreateIn(BaseModel):
    email: EmailStr
    is_active: bool = True


class AdminNewsletterUpdateIn(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None


class AdminSiteSettingsIn(BaseModel):
    model_config = ConfigDict(extra="allow")


class AdminStatsOut(BaseModel):
    total_perfumes: int
    total_fragrance_types: int
    featured_count: int
    best_seller_count: int
    low_stock_count: int = 0
    new_orders_count: int = 0
