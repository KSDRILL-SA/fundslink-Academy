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


# Upper bound on any password input — bcrypt's SHA-256 pre-hash handles long inputs correctly,
# but capping the field rejects pathological payloads at the boundary (DoS guard, S2.23).
_PW_MAX = 128


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=_PW_MAX)
    consents: list[ConsentInput]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=_PW_MAX)
    mfa_code: str | None = Field(default=None, description="Required for privileged roles")


class AuthTokens(BaseModel):
    """The access token only — the refresh token rides an HttpOnly cookie (S3.14)."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class MfaEnrollResponse(BaseModel):
    """Returned once at enrolment — the client renders the QR and shows recovery codes."""

    secret: str
    provisioning_uri: str
    recovery_codes: list[str]


class MfaActivateRequest(BaseModel):
    code: str


class VerifyEmailRequest(BaseModel):
    token: str


class EmailRequest(BaseModel):
    """Resend-verification / forgot-password — by email (enumeration-proof response)."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=10, max_length=_PW_MAX)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=_PW_MAX)
    new_password: str = Field(min_length=10, max_length=_PW_MAX)
