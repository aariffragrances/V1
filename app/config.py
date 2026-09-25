from functools import lru_cache
from sqlalchemy.engine import URL, make_url
from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT", "app_env", "environment"),
    )
    app_host: str = "127.0.0.1"
    app_port: int = 8001
    secret_key: str = "change-me"
    session_expire_minutes: int = 60 * 24 * 7

    # Neon Cloud PostgreSQL Connection
    database_connection_url: str = Field(
        default="",
        validation_alias=AliasChoices("DATABASE_URL", "NEON_DATABASE_URL"),
    )
    neon_data_api_url: str = Field(
        default="",
        validation_alias=AliasChoices("NEON_DATA_API_URL", "NEON_REST_URL"),
    )

    cloudinary_cloud_name: str = Field(
        default="",
        validation_alias=AliasChoices("CLOUDINARY_CLOUD_NAME", "cloudinary_cloud_name"),
    )
    cloudinary_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("CLOUDINARY_API_KEY", "cloudinary_api_key"),
    )
    cloudinary_api_secret: str = Field(
        default="",
        validation_alias=AliasChoices("CLOUDINARY_API_SECRET", "cloudinary_api_secret"),
    )
    cloudinary_upload_preset: str = Field(
        default="AARIF_FRAGRANCES",
        validation_alias=AliasChoices("CLOUDINARY_UPLOAD_PRESET", "cloudinary_upload_preset"),
    )
    cloudinary_folder: str = Field(
        default="aarif-fragrances",
        validation_alias=AliasChoices("CLOUDINARY_FOLDER", "cloudinary_folder"),
    )

    cors_origins: str = "http://127.0.0.1:8001,http://localhost:8001,https://aariffragnances.netlify.app"

    @property
    def cloudinary_configured(self) -> bool:
        c = (self.cloudinary_cloud_name or "").strip()
        k = (self.cloudinary_api_key or "").strip()
        s = (self.cloudinary_api_secret or "").strip()
        if not c or not k or not s:
            return False
        if "YOUR_CLOUDINARY" in c or "YOUR_CLOUDINARY" in k or "YOUR_CLOUDINARY" in s:
            return False
        return True

    @property
    def is_neon_configured(self) -> bool:
        return bool(self.database_connection_url and self.database_connection_url.strip())

    @property
    def database_url(self) -> URL:
        raw_url = (self.database_connection_url or "").strip()
        if not raw_url:
            raise ValueError(
                "DATABASE_URL is not configured. Neon Cloud PostgreSQL is required."
            )
        parsed = make_url(raw_url)
        drivername = parsed.drivername.replace("postgres://", "postgresql://")
        if drivername in {"postgresql", "postgres"}:
            drivername = "postgresql+asyncpg"
        query = dict(parsed.query)
        # Remove libpq parameters unsupported by asyncpg
        query.pop("channel_binding", None)
        if query.get("sslmode") and "ssl" not in query:
            query["ssl"] = query.pop("sslmode")
        elif "ssl" not in query:
            query["ssl"] = "require"
        return parsed.set(drivername=drivername, query=query)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.app_env.lower() == "production":
            weak = {"", "change-me", "change-me-to-a-long-random-string"}
            if self.secret_key in weak or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be a non-default value of at least 32 characters in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
