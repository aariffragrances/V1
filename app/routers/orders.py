"""Public order creation for WhatsApp checkout."""
from __future__ import annotations

import random
import string
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.orders import Order, OrderItem

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


class OrderItemIn(BaseModel):
    perfume_id: str | None = None
    perfume_name: str
    size: str | None = None
    qty: int = Field(ge=1, le=99)
    price: float | None = None


class OrderCreateIn(BaseModel):
    order_ref: str | None = None
    customer_note: str | None = None
    whatsapp_message: str | None = None
    items: list[OrderItemIn] = Field(min_length=1)


def _gen_ref() -> str:
    n = random.randint(1000, 9999)
    suffix = "".join(random.choices(string.ascii_uppercase, k=2))
    return f"AF-{n}{suffix}"


@router.post("")
async def create_order(body: OrderCreateIn, db: AsyncSession = Depends(get_db)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Order requires at least one item")

    ref = (body.order_ref or "").strip().upper() or _gen_ref()
    # Ensure unique
    for _ in range(5):
        exists = (
            await db.execute(select(Order.id).where(Order.order_ref == ref))
        ).scalar_one_or_none()
        if not exists:
            break
        ref = _gen_ref()

    from sqlalchemy.exc import IntegrityError

    total_units = sum(max(1, int(i.qty)) for i in body.items)

    for attempt in range(5):
        order = Order(
            order_ref=ref,
            status="new",
            customer_note=body.customer_note,
            whatsapp_message=body.whatsapp_message,
            total_units=total_units,
        )
        for item in body.items:
            order.items.append(
                OrderItem(
                    perfume_id=item.perfume_id,
                    perfume_name=item.perfume_name,
                    size=item.size,
                    qty=max(1, int(item.qty)),
                    price=Decimal(str(item.price)) if item.price is not None else None,
                )
            )
        db.add(order)
        try:
            await db.commit()
            await db.refresh(order)
            return {"ok": True, "order_ref": order.order_ref, "id": order.id, "total_units": total_units}
        except IntegrityError:
            await db.rollback()
            ref = _gen_ref()

    raise HTTPException(status_code=409, detail="Order reference conflict, please try again")


@router.get("/{order_ref}")
async def get_order_public(order_ref: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_ref == order_ref.upper())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_ref": order.order_ref,
        "status": order.status,
        "total_units": order.total_units,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [
            {
                "perfume_id": i.perfume_id,
                "perfume_name": i.perfume_name,
                "size": i.size,
                "qty": i.qty,
                "price": float(i.price) if i.price is not None else None,
            }
            for i in order.items
        ],
    }
