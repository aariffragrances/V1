import asyncio
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import SESSION_COOKIE_NAME, hash_session_token, security
from app.core.rate_limit import rate_limit
from app.core.auth import (
    create_session,
    hash_password,
    require_user,
    verify_password,
)
from app.database import get_db
from app.models import Account, Session, User
from app.schemas import AuthOut, CustomerProfileUpdateIn, LoginIn, RegisterIn, UserProfileOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=settings.session_expire_minutes * 60,
        httponly=True,
        secure=settings.app_env.lower() == "production",
        samesite="lax",
        path="/",
    )


def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "phone_country": user.phone_country or "IN",
        "address": user.address,
        "role": user.role,
    }


def profile_out(user: User) -> UserProfileOut:
    return UserProfileOut(**user_to_dict(user))


def normalize_login(value: str) -> str:
    return value.strip()


async def prepare_registration(db: AsyncSession, email: str, phone: str) -> str:
    base = re.sub(r"[^a-z0-9_]", "", email.split("@")[0].lower()) or "user"
    base = base[:40]

    dup_conditions = [func.lower(User.email) == email.lower()]
    if phone:
        dup_conditions.append(User.phone == phone)

    dup_part = select(
        literal("dup").label("kind"),
        User.email.label("email"),
        User.phone.label("phone"),
        literal(None).label("username"),
    ).where(or_(*dup_conditions))

    user_part = select(
        literal("user").label("kind"),
        literal(None).label("email"),
        literal(None).label("phone"),
        User.username.label("username"),
    ).where(func.lower(User.username).like(f"{base.lower()}%"))

    result = await db.execute(union_all(dup_part, user_part))

    taken: set[str] = set()
    for row in result.all():
        if row.kind == "dup":
            if row.email and row.email.lower() == email.lower():
                raise HTTPException(status_code=400, detail="Email already registered")
            if phone and row.phone == phone:
                raise HTTPException(status_code=400, detail="Phone number already registered")
        elif row.username:
            taken.add(row.username.lower())

    candidate = base
    suffix = 1
    while candidate.lower() in taken:
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate


async def find_user_by_login(db: AsyncSession, login: str) -> User | None:
    login = normalize_login(login)
    if not login:
        return None
    email_login = login.lower()
    username_login = login.lower()
    conditions = [
        func.lower(User.email) == email_login,
        func.lower(User.username) == username_login,
        User.phone == login,
    ]
    result = await db.execute(select(User).where(or_(*conditions)))
    return result.scalar_one_or_none()


@router.post(
    "/register",
    response_model=AuthOut,
    dependencies=[Depends(rate_limit(namespace="auth-register", limit=10, window_seconds=900))],
)
async def register(body: RegisterIn, response: Response, db: AsyncSession = Depends(get_db)):
    phone = body.phone.strip()

    hash_task = asyncio.create_task(asyncio.to_thread(hash_password, body.password))
    username = await prepare_registration(db, body.email, phone)
    password_hash = await hash_task

    user = User(
        id=uuid.uuid4(),
        name=body.name.strip(),
        username=username,
        email=body.email,
        phone=phone,
        phone_country=body.phone_country,
        address=body.address.strip(),
        role="customer",
    )
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.session_expire_minutes)

    db.add(user)
    db.add(
        Account(
            user_id=user.id,
            type="email",
            provider="credentials",
            provider_account_id=body.email,
            access_token=password_hash,
        )
    )
    db.add(Session(user_id=user.id, session_token=hash_session_token(token), expires=expires))
    await db.flush()
    _set_session_cookie(response, token)
    return AuthOut(session_token=token, user=profile_out(user))


@router.post(
    "/login",
    response_model=AuthOut,
    dependencies=[Depends(rate_limit(namespace="auth-login", limit=8, window_seconds=300))],
)
async def login(body: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    user = await find_user_by_login(db, body.login)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    acc_result = await db.execute(
        select(Account).where(
            Account.user_id == user.id,
            Account.provider == "credentials",
        )
    )
    account = acc_result.scalar_one_or_none()
    if not account or not account.access_token or not verify_password(body.password, account.access_token):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = await create_session(db, user.id)
    await db.refresh(user)
    _set_session_cookie(response, token)
    return AuthOut(session_token=token, user=profile_out(user))


@router.get("/me", response_model=UserProfileOut)
async def me(user: User = Depends(require_user)):
    return profile_out(user)


@router.patch("/me/profile", response_model=UserProfileOut)
async def update_profile(
    body: CustomerProfileUpdateIn,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name.strip()
    if body.address is not None:
        user.address = body.address.strip()
    if body.phone is not None:
        user.phone = body.phone.strip()
    if body.phone_country is not None:
        user.phone_country = body.phone_country
    await db.flush()
    await db.refresh(user)
    return profile_out(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Session as UserSession

    token = creds.credentials if creds else request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        await db.execute(
            UserSession.__table__.delete().where(UserSession.session_token == hash_session_token(token))
        )
    else:
        await db.execute(UserSession.__table__.delete().where(UserSession.user_id == user.id))
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"ok": True}
