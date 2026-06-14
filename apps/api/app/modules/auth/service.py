"""Auth service — orchestrates register / login / refresh / logout (S3.13-S3.18, S3.33).

Service layer: business logic only, no DB driver import (uses repositories; layering S4.79).
The request dependency sets the RLS context before any method runs — SYSTEM context for the
login authority (register/login/refresh, D-015), the user's context for authenticated calls.
Every mutation writes audit_log in the same transaction (S3.33).
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.common.errors import AppError
from app.core.config import settings
from app.modules.auth import passwords
from app.modules.auth.jwt import create_access_token
from app.modules.auth.ratelimit import LoginRateLimiter, TokenDenyList
from app.modules.auth.repository import (
    AuditRepository,
    ConsentRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.modules.auth.schemas import AuthTokens, RegisterRequest
from app.modules.auth.tokens import hash_refresh_token, new_refresh_token

# JWT role claim precedence when a user holds more than one role (v1 users hold exactly one).
_ROLE_PRECEDENCE = [
    "ADMIN_AUTHORIZER",
    "ADMIN_REVIEWER",
    "FINANCE_ADMIN",
    "INSTITUTION_OFFICER",
    "COUNSELLOR",
    "DONOR",
    "GRADUATE",
    "STUDENT",
]


def _now() -> datetime:
    return datetime.now(UTC)


class AuthService:
    def __init__(self, session, redis) -> None:
        self.session = session  # security side-effects on error paths must be committed
        self.users = UserRepository(session)
        self.refresh = RefreshTokenRepository(session)
        self.consents = ConsentRepository(session)
        self.audit = AuditRepository(session)
        self.denylist = TokenDenyList(redis)
        self.ratelimiter = LoginRateLimiter(redis)

    # ---- error helpers: identical credential/token errors (S3.4 AP-S3.4b, no enumeration) ----
    @staticmethod
    def _invalid_credentials() -> AppError:
        return AppError("invalid_credentials", "Invalid email or password", status_code=401)

    @staticmethod
    def _invalid_token() -> AppError:
        return AppError("invalid_token", "Invalid or expired session", status_code=401)

    @staticmethod
    def _primary_role(roles: list[str]) -> str:
        for role in _ROLE_PRECEDENCE:
            if role in roles:
                return role
        return roles[0] if roles else "STUDENT"

    async def _issue(
        self,
        *,
        user_id: str,
        email: str,
        role: str,
        token_version: int,
        request_id: str,
        action: str,
    ) -> tuple[AuthTokens, str]:
        """Mint a fresh family + refresh token + access token; audit it. Returns (tokens, raw)."""
        family_id = await self.refresh.create_family(user_id)
        raw, token_hash = new_refresh_token()
        await self.refresh.create_token(
            family_id=family_id,
            token_hash=token_hash,
            ttl_seconds=settings.refresh_token_ttl_seconds,
        )
        access, _jti = create_access_token(
            sub=user_id, role=role, email=email, version=token_version
        )
        await self.audit.write(
            actor_user_id=user_id, action=action, resource_type="user",
            resource_id=user_id, request_id=request_id,
        )
        return AuthTokens(access_token=access, expires_in=settings.access_token_ttl_seconds), raw

    async def _reject_login(self, email: str, request_id: str, reason: str) -> AppError:
        """Durably audit a failed login (S3.33) then return the identical 401 to raise.

        The audit is committed here because the request raises — otherwise the dependency's
        rollback would erase the security record (and S3.33 forbids omitting failures)."""
        await self.audit.write(
            actor_user_id=None, action="AUTH_LOGIN_FAILURE", resource_type="user",
            resource_id=None, request_id=request_id, detail={"email": email, "reason": reason},
        )
        await self.session.commit()
        return self._invalid_credentials()

    # ---------------------------------- register ----------------------------------
    async def register(self, req: RegisterRequest, *, request_id: str) -> tuple[AuthTokens, str]:
        passwords.validate_strength(req.password)
        if await passwords.is_breached(req.password):
            raise AppError(
                "password_breached",
                "This password has appeared in a known data breach; choose another",
                status_code=422,
            )
        if await self.users.email_exists(req.email):
            raise AppError(
                "email_taken", "An account with this email already exists", status_code=409
            )

        # Validate consent purposes against the lookup (BR-A05) so a bad purpose is a friendly
        # 422, not a database FK 500.
        valid_purposes = await self.consents.valid_purposes()
        unknown = [c.purpose for c in req.consents if c.purpose not in valid_purposes]
        if unknown:
            raise AppError(
                "invalid_consent_purpose",
                f"Unknown consent purpose(s): {', '.join(sorted(set(unknown)))}",
                status_code=422,
                details={"allowed": sorted(valid_purposes)},
            )

        password_hash = passwords.hash_password(req.password)
        state = "PENDING_VERIFICATION" if settings.email_verification_required else "ACTIVE"
        user_id = await self.users.create(
            email=req.email, password_hash=password_hash, account_state=state
        )
        await self.users.assign_role(user_id, "STUDENT")  # least-privilege default (S3.24)
        for consent in req.consents:
            await self.consents.record(
                user_id=user_id, purpose=consent.purpose, wording_version=consent.wording_version
            )
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_REGISTER", resource_type="user",
            resource_id=user_id, request_id=request_id, detail={"email": req.email},
        )
        return await self._issue(
            user_id=user_id, email=req.email, role="STUDENT", token_version=1,
            request_id=request_id, action="AUTH_REGISTER",
        )

    # ----------------------------------- login ------------------------------------
    async def login(
        self, email: str, password: str, *, ip: str, request_id: str
    ) -> tuple[AuthTokens, str]:
        identifier = f"{email.lower()}|{ip}"
        if not await self.ratelimiter.ip_allowed(ip) or not await self.ratelimiter.global_allowed():
            raise AppError(
                "rate_limited", "Too many requests; please try again later", status_code=429
            )
        if await self.ratelimiter.is_locked(identifier):
            raise await self._reject_login(email, request_id, "account_locked")

        user = await self.users.get_by_email(email)
        if user is None or user[0] == "SYSTEM":  # SYSTEM principal can never authenticate
            await self.ratelimiter.record_failure(identifier)
            raise await self._reject_login(email, request_id, "no_such_user")

        user_id, db_email, password_hash, account_state, _mfa, token_version, _deleted = user
        if not passwords.verify_password(password, password_hash):
            locked = await self.ratelimiter.record_failure(identifier)
            reason = "locked" if locked else "bad_password"
            raise await self._reject_login(db_email, request_id, reason)
        if account_state != "ACTIVE":  # identical error — never reveal state (no enumeration)
            raise await self._reject_login(db_email, request_id, f"state_{account_state}")

        roles = await self.users.get_role_codes(user_id)
        role = self._primary_role(roles)
        # MFA enforcement for privileged roles is layered in by PR-F (enforce_mfa hook).
        await self.ratelimiter.clear_failures(identifier)
        return await self._issue(
            user_id=user_id, email=db_email, role=role, token_version=token_version,
            request_id=request_id, action="AUTH_LOGIN_SUCCESS",
        )

    # ---------------------------------- refresh -----------------------------------
    async def refresh_session(
        self, raw_token: str | None, *, request_id: str
    ) -> tuple[AuthTokens, str]:
        if not raw_token:
            raise self._invalid_token()
        row = await self.refresh.get_token_by_hash(hash_refresh_token(raw_token))
        if row is None:
            raise self._invalid_token()
        token_id, family_id, used_at, expires_at, user_id, family_revoked = row

        # Reuse detection (S3.16): a rotated (used) token or an already-revoked family means
        # theft — revoke the entire family, alert, and refuse.
        if used_at is not None or family_revoked is not None:
            await self.refresh.revoke_family(family_id)
            await self.audit.write(
                actor_user_id=user_id, action="AUTH_TOKEN_REUSE_DETECTED",
                resource_type="refresh_token_family", resource_id=family_id, request_id=request_id,
            )
            await self.session.commit()  # the revocation MUST persist despite the 401 (S3.16)
            self._alert_token_reuse(user_id, family_id)
            raise self._invalid_token()

        if expires_at < _now():
            raise self._invalid_token()

        user = await self.users.get_by_id(user_id)
        if user is None or user[3] != "ACTIVE":
            raise self._invalid_token()
        _uid, db_email, _ph, _state, _mfa, token_version, _deleted = user

        await self.refresh.mark_used(token_id)  # rotate: the presented token is now spent
        role = self._primary_role(await self.users.get_role_codes(user_id))
        raw, token_hash = new_refresh_token()
        await self.refresh.create_token(
            family_id=family_id,
            token_hash=token_hash,
            ttl_seconds=settings.refresh_token_ttl_seconds,
        )
        access, _jti = create_access_token(
            sub=user_id, role=role, email=db_email, version=token_version
        )
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_TOKEN_REFRESH", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )
        return AuthTokens(access_token=access, expires_in=settings.access_token_ttl_seconds), raw

    # ---------------------------------- logout ------------------------------------
    async def logout(
        self,
        *,
        user_id: str,
        jti: str,
        access_expires_at: int,
        raw_refresh: str | None,
        request_id: str,
    ) -> None:
        if raw_refresh:
            row = await self.refresh.get_token_by_hash(hash_refresh_token(raw_refresh))
            if row is not None:
                await self.refresh.revoke_family(row[1])  # family_id
        ttl = max(access_expires_at - int(_now().timestamp()), 0)
        await self.denylist.deny(jti, ttl)
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_LOGOUT", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    @staticmethod
    def _alert_token_reuse(user_id: str, family_id: str) -> None:
        """Raise a Sentry alert on token theft (S3.16 / S3.34). No-op without a DSN."""
        try:
            import sentry_sdk

            sentry_sdk.capture_message(
                f"Refresh-token reuse detected: family {family_id} (user {user_id}) revoked",
                level="warning",
            )
        except Exception:  # observability must never break the security action
            pass
