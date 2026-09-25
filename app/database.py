from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

db_url_str = str(settings.database_url)
is_pooler = "pooler" in db_url_str or "neon.tech" in db_url_str

connect_args = {
    "timeout": 25,
    "command_timeout": 60,
}
if is_pooler:
    # PgBouncer / Neon pooler in transaction mode cannot cache prepared statements
    connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,   # Essential for Neon serverless idle wakeups
    pool_size=5 if is_pooler else 15,
    max_overflow=10 if is_pooler else 20,
    pool_timeout=30,
    pool_recycle=1800,    # Recycle connections before Neon 30m idle timeout
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
