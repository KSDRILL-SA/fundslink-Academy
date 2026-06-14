"""Typed application settings (S3.20 — secrets from the environment, never hardcoded).

Security-sensitive values (RS256 keys, PII key, Sentry DSN) default to empty so the app
boots in local dev without them; the component that needs one validates its presence at use
(e.g. the JWT service refuses to sign without a private key). Production supplies every value
via Railway Secrets — `.env.example` lists the names only (S3.20, CF-04).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FundsLink API"
    app_version: str = "0.1.0"
    environment: str = "development"  # development | staging | production

    # PostgreSQL — async runtime via asyncpg (ADR-003). In every deployed environment this
    # MUST authenticate as the non-owner role `fundslink_app` (handoff contract #1); the dev
    # default mirrors infra/docker-compose.dev.yml and is never a committed secret (S3.20).
    database_url: str = "postgresql+asyncpg://fundslink:fundslink@localhost:5432/fundslink"

    # Redis — token deny-list + rate-limit counters (S3.4/S3.18); cache, never primary (S3.2).
    redis_url: str = "redis://localhost:6379/0"

    # --- JWT / auth (C3 Part 2) ---
    rs256_private_key: str = ""  # PEM; signs access tokens (Railway Secrets only) — S3.13/S3.20
    rs256_public_key: str = ""  # PEM; verifies access tokens (safely distributable) — S3.13
    access_token_ttl_seconds: int = 900  # 15 min (S3.1/TAD §3.1)
    refresh_token_ttl_seconds: int = 604800  # 7 days (TAD §3.1)
    jwt_issuer: str = "fundslink-api"
    bcrypt_rounds: int = 12  # cost factor from env, never hardcoded in a call (S3.3)
    # Email-verification mode (S3.12). False (progressive) until the verify flow ships (PR-G).
    email_verification_required: bool = False

    # --- PII field encryption (TAD §4.4) — AES-256-GCM; base64 of 32 random bytes ---
    pii_encryption_key: str = ""

    # --- Web security baseline (C3 Part 5) ---
    # Comma-separated allowlist; never "*" in staging/production (S3.29). Read via cors_origins.
    cors_allowed_origins: str = "http://localhost:4200"

    # --- Observability ---
    sentry_dsn: str = ""  # empty => Sentry disabled (local dev)
    sentry_traces_sample_rate: float = 0.0

    @property
    def cors_origins(self) -> list[str]:
        """The CORS allowlist as a clean list (empty entries dropped)."""
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()
