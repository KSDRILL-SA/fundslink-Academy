"""Auth request/response schemas — mirror packages/contracts/openapi.yaml (S2.7).

These Pydantic models ARE the contract surface FastAPI generates; the contract-diff CI gate
fails on drift. Field constraints match the OpenAPI definitions (e.g. password minLength 10).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ConsentInput(BaseModel):
    purpose: str
    wording_version: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10)
    consents: list[ConsentInput]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: str | None = Field(default=None, description="Required for privileged roles")


class AuthTokens(BaseModel):
    """The access token only — the refresh token rides an HttpOnly cookie (S3.14)."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
