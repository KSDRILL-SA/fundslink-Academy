"""Typed application settings (S3.20 — secrets from the environment, never hardcoded).

Stage-00 scaffold keeps this minimal; DATABASE_URL, REDIS_URL, RS256 keys, etc.
are introduced in the stages that need them (see system context env table).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FundsLink API"
    app_version: str = "0.1.0"
    environment: str = "development"

    # PostgreSQL — the async runtime path uses asyncpg (ADR-003 / infra compose).
    # Dev default mirrors infra/docker-compose.dev.yml; real value comes from the
    # environment (DATABASE_URL) and is never a committed secret (S3.20).
    database_url: str = "postgresql+asyncpg://fundslink:fundslink@localhost:5432/fundslink"


settings = Settings()
