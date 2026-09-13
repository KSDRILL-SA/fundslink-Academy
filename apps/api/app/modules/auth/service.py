"""Auth service — orchestrates register / login / refresh / logout (S3.13-S3.18, S3.33).

Service layer: business logic only, no DB driver import (uses repositories; layering S4.79).
The request dependency sets the RLS context before any method runs — SYSTEM context for the
login authority (register/login/refresh, D-015), the user's context for authenticated calls.
Every mutation writes audit_log in the same transaction (S3.33).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from app.common.errors import AppError
from app.core.config import settings
from app.modules.auth import crypto, mfa, passwords
from app.modules.auth.email import get_email_adapter
from app.modules.auth.jwt import create_access_token
from app.modules.auth.ratelimit import IP_WINDOW, LoginRateLimiter, TokenDenyList
from app.modules.auth.repository import (
    AuditRepository,
    AuthTokenRepository,
    ConsentRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.modules.auth.schemas import AuthTokens, RegisterRequest
from app.modules.auth.tokens import hash_refresh_token, new_opaque_token, new_refresh_token

EMAIL_VERIFY_TTL = 24 * 3600  # 24h (S3.12)
PASSWORD_RESET_TTL = 3600  # 1h (S3.30)

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
        self.auth_tokens = AuthTokenRepository(session)
        self.email = get_email_adapter()
        self.redis = redis  # raw client for the TOTP replay guard
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

    async def _notify_lockout(self, email: str, request_id: str) -> None:
        """On the 5th failure (S3.4): a distinct audit event + a security email to the address."""
        await self.audit.write(
            actor_user_id=None, action="AUTH_ACCOUNT_LOCKED", resource_type="user",
            resource_id=None, request_id=request_id, detail={"email": email},
        )
        await self.email.send(
            to=email,
            subject="FundsLink security alert — account temporarily locked",
            body=(
                "We locked sign-in for 15 minutes after several failed attempts. If this "
                "wasn't you, your password may be exposed — reset it from the sign-in page."
            ),
        )

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
        # No audit write here: _issue records AUTH_REGISTER below. There used to be one here too, so
        # every account was audited as registering twice — which doubled any registration count
        # read from the log (#294) — and this copy put the email address into an append-only table
        # that can never be erased, when the user row already holds it.
        if settings.email_verification_required:
            await self._send_verification(user_id, req.email, request_id)
        return await self._issue(
            user_id=user_id, email=req.email, role="STUDENT", token_version=1,
            request_id=request_id, action="AUTH_REGISTER",
        )

    # ------------------------- email verification (S3.12) -------------------------
    async def _send_verification(self, user_id: str, email: str, request_id: str) -> None:
        raw, token_hash = new_opaque_token()
        await self.auth_tokens.create(
            user_id=user_id,
            kind="EMAIL_VERIFY",
            token_hash=token_hash,
            ttl_seconds=EMAIL_VERIFY_TTL,
        )
        await self.email.send(
            to=email,
            subject="Verify your FundsLink email",
            body=f"Confirm your email with this token (valid 24h): {raw}",
        )
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_EMAIL_VERIFICATION_SENT", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    async def verify_email(self, *, token: str, request_id: str) -> None:
        row = await self.auth_tokens.get_active_by_hash(hash_refresh_token(token), "EMAIL_VERIFY")
        token_id, user_id = self._consume_token_or_fail(row)
        await self.auth_tokens.mark_used(token_id)
        await self.users.set_account_state(user_id, "ACTIVE")
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_EMAIL_VERIFIED", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    async def resend_verification(self, *, email: str, request_id: str) -> None:
        """Always succeeds to the caller (enumeration-proof); only acts for a pending account."""
        user = await self.users.get_by_email(email)
        if user is not None and user[0] != "SYSTEM" and user[3] == "PENDING_VERIFICATION":
            await self._send_verification(user[0], user[1], request_id)

    # ----------------------------- password reset (S3.30) -------------------------
    async def forgot_password(self, *, email: str, request_id: str) -> None:
        """Enumeration-proof (S3.30): identical outcome whether or not the account exists."""
        user = await self.users.get_by_email(email)
        if user is None or user[0] == "SYSTEM":
            return
        user_id = user[0]
        raw, token_hash = new_opaque_token()
        await self.auth_tokens.create(
            user_id=user_id,
            kind="PASSWORD_RESET",
            token_hash=token_hash,
            ttl_seconds=PASSWORD_RESET_TTL,
        )
        await self.email.send(
            to=user[1],
            subject="Reset your FundsLink password",
            body=f"Reset your password with this token (valid 1h): {raw}",
        )
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_PASSWORD_RESET_REQUESTED", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    async def reset_password(self, *, token: str, new_password: str, request_id: str) -> None:
        await self._validate_new_password(new_password)
        row = await self.auth_tokens.get_active_by_hash(hash_refresh_token(token), "PASSWORD_RESET")
        token_id, user_id = self._consume_token_or_fail(row)
        await self.auth_tokens.mark_used(token_id)
        await self.users.set_password_hash(user_id, passwords.hash_password(new_password))
        await self._revoke_all_sessions(user_id)  # S3.35
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_PASSWORD_RESET", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    # ---------------------------- password change (S3.35) -------------------------
    async def change_password(
        self, *, user_id: str, current_password: str, new_password: str, request_id: str
    ) -> None:
        user = await self.users.get_by_id(user_id)
        if user is None or not passwords.verify_password(current_password, user[2]):
            raise AppError("invalid_credentials", "Current password is incorrect", status_code=401)
        await self._validate_new_password(new_password)
        await self.users.set_password_hash(user_id, passwords.hash_password(new_password))
        await self._revoke_all_sessions(user_id)  # S3.35 — log out everywhere
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_PASSWORD_CHANGED", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )

    # --------------------------------- helpers ------------------------------------
    @staticmethod
    def _consume_token_or_fail(row) -> tuple[str, str]:
        """Validate an auth_token row (exists, unused, unexpired); return (token_id, user_id)."""
        if row is None or row[3] is not None or row[2] < _now():
            raise AppError("invalid_token", "This link is invalid or has expired", status_code=400)
        return row[0], row[1]

    async def _validate_new_password(self, password: str) -> None:
        passwords.validate_strength(password)
        if await passwords.is_breached(password):
            raise AppError(
                "password_breached",
                "This password has appeared in a known data breach; choose another",
                status_code=422,
            )

    async def _revoke_all_sessions(self, user_id: str) -> None:
        await self.refresh.revoke_all_for_user(user_id)
        await self.users.bump_token_version(user_id)

    # ----------------------------------- login ------------------------------------
    async def login(
        self, email: str, password: str, *, ip: str, request_id: str, mfa_code: str | None = None
    ) -> tuple[AuthTokens, str | None]:
        identifier = f"{email.lower()}|{ip}"
        if not await self.ratelimiter.ip_allowed(ip) or not await self.ratelimiter.global_allowed():
            raise AppError(
                "rate_limited",
                "Too many requests; please try again later",
                status_code=429,
                headers={"Retry-After": str(IP_WINDOW)},
            )
        if await self.ratelimiter.is_locked(identifier):
            raise await self._reject_login(email, request_id, "account_locked")

        user = await self.users.get_by_email(email)
        if user is None or user[0] == "SYSTEM":  # SYSTEM principal can never authenticate
            passwords.verify_dummy(password)  # constant-time: equalise login timing (ST-2)
            if await self.ratelimiter.record_failure(identifier):
                await self._notify_lockout(email, request_id)
            raise await self._reject_login(email, request_id, "no_such_user")

        (user_id, db_email, password_hash, account_state, secret_enc, mfa_enabled,
         token_version, _deleted) = user
        if not passwords.verify_password(password, password_hash):
            if await self.ratelimiter.record_failure(identifier):
                await self._notify_lockout(db_email, request_id)
            raise await self._reject_login(db_email, request_id, "bad_password")
        if account_state != "ACTIVE":  # identical error — never reveal state (no enumeration)
            raise await self._reject_login(db_email, request_id, f"state_{account_state}")

        role = self._primary_role(await self.users.get_role_codes(user_id))

        # MFA enforcement for privileged roles (TAD §3.1).
        if mfa.role_requires_mfa(role):
            if not mfa_enabled:
                # Un-enrolled privileged user: issue ONLY a short step-up token (scope=mfa_pending)
                # that can reach the MFA endpoints but no business route — "MFA blocks the admin".
                await self.ratelimiter.clear_failures(identifier)
                await self.audit.write(
                    actor_user_id=user_id, action="AUTH_MFA_ENROLLMENT_REQUIRED",
                    resource_type="user", resource_id=user_id, request_id=request_id,
                )
                access, _jti = create_access_token(
                    sub=user_id, role=role, email=db_email, version=token_version,
                    scope="mfa_pending", ttl=settings.access_token_ttl_seconds,
                )
                tokens = AuthTokens(
                    access_token=access, expires_in=settings.access_token_ttl_seconds
                )
                return tokens, None
            if not await self._verify_mfa(user_id, secret_enc, mfa_code):
                locked = await self.ratelimiter.record_failure(identifier)
                reason = "locked" if locked else "mfa"
                raise await self._reject_login(db_email, request_id, reason)

        await self.ratelimiter.clear_failures(identifier)
        return await self._issue(
            user_id=user_id, email=db_email, role=role, token_version=token_version,
            request_id=request_id, action="AUTH_LOGIN_SUCCESS",
        )

    async def _verify_mfa(self, user_id: str, secret_enc: str | None, code: str | None) -> bool:
        """Accept a valid TOTP (single-use per time-step), or a single-use recovery code."""
        if not code or not secret_enc:
            return False
        step = mfa.matched_step(crypto.decrypt(secret_enc), code)
        if step is not None:
            # Replay guard (ST-2): a given TOTP step is usable once. SET NX with a short TTL —
            # a captured code cannot be reused inside its 30-90s validity window.
            fresh = await self.redis.set(f"mfa:used:{user_id}:{step}", "1", nx=True, ex=90)
            return bool(fresh)
        # Recovery-code path: match a stored hash, then consume it.
        row = await self.users.get_mfa(user_id)
        recovery_enc = row[2] if row else None
        if not recovery_enc:
            return False
        codes = json.loads(crypto.decrypt(recovery_enc))
        digest = mfa.hash_recovery_code(code)
        if digest in codes:
            codes.remove(digest)
            await self.users.set_mfa_recovery(user_id, crypto.encrypt(json.dumps(codes)))
            return True
        return False

    # ------------------------------------ MFA -------------------------------------
    async def enroll_mfa(self, *, user_id: str, email: str, request_id: str) -> dict:
        """Generate a TOTP secret + recovery codes (stored pending activation). Shown once."""
        secret = mfa.generate_secret()
        recovery = mfa.generate_recovery_codes()
        await self.users.set_mfa_pending(
            user_id,
            secret_enc=crypto.encrypt(secret),
            recovery_enc=crypto.encrypt(json.dumps([mfa.hash_recovery_code(c) for c in recovery])),
        )
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_MFA_ENROLLED", resource_type="user",
            resource_id=user_id, request_id=request_id,
        )
        return {
            "secret": secret,
            "provisioning_uri": mfa.provisioning_uri(secret, email),
            "recovery_codes": recovery,
        }

    async def activate_mfa(self, *, user_id: str, code: str, request_id: str) -> None:
        """Confirm enrolment by verifying a first TOTP, then turn MFA on (TAD §3.1)."""
        row = await self.users.get_mfa(user_id)
        secret_enc = row[0] if row else None
        if not secret_enc:
            raise AppError("mfa_not_enrolled", "Start MFA enrolment first", status_code=409)
        if not mfa.verify_totp(crypto.decrypt(secret_enc), code):
            raise AppError("mfa_invalid_code", "Invalid authenticator code", status_code=401)
        await self.users.enable_mfa(user_id)
        await self.audit.write(
            actor_user_id=user_id, action="AUTH_MFA_ACTIVATED", resource_type="user",
            resource_id=user_id, request_id=request_id,
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
