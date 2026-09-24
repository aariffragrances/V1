from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FragranceType(Base):
    __tablename__ = "fragrance_types"

    type_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    icon_image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())

    perfumes: Mapped[list["Perfume"]] = relationship(back_populates="fragrance_type")


class Perfume(Base):
    __tablename__ = "perfumes"

    perfume_id: Mapped[str] = mapped_column(String(25), primary_key=True)
    fragrance_type_id: Mapped[str] = mapped_column(String(10), ForeignKey("fragrance_types.type_id"), nullable=False)
    perfume_name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_6ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_12ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_30ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_50ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    is_attar: Mapped[bool] = mapped_column(Boolean, default=False)
    is_perfume: Mapped[bool] = mapped_column(Boolean, default=True)
    is_car_hanger: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_best_seller: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new_arrival: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fragrance_type: Mapped["FragranceType"] = relationship(back_populates="perfumes")
    images: Mapped[list["PerfumeImage"]] = relationship(back_populates="perfume", order_by="PerfumeImage.display_order")


class PerfumeImage(Base):
    __tablename__ = "perfume_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    perfume_id: Mapped[str] = mapped_column(String(25), ForeignKey("perfumes.perfume_id"), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())

    perfume: Mapped["Perfume"] = relationship(back_populates="images")
