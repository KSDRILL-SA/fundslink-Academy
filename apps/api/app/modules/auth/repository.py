"""Auth repositories (DB-D2 boundary) — the ONLY auth files that touch a DB driver.

Parameterised SQL via app.db.sql (named binds only — DB-D20/S5.21). Auth is CRUD, but using
parameterised Core text keeps us free of ORM model duplication over the migration-owned schema.
Every method runs inside the caller's transaction with RLS context already set by the request
dependency (system context for the login flow; user context for authenticated calls).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError
from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository


class UserRepository(BaseRepository):
    async def get_by_email(self, email: str):
        return await sql.fetch_one(
            self.session,
            'SELECT id, email, password_hash, account_state, mfa_secret_enc, mfa_enabled,'
            ' token_version, deleted_at FROM "user"'
            " WHERE lower(email) = lower(:email) AND deleted_at IS NULL",
            email=email,
        )

    async def get_by_id(self, user_id: str):
        return await sql.fetch_one(
            self.session,
            'SELECT id, email, password_hash, account_state, mfa_secret_enc, token_version,'
            ' deleted_at FROM "user" WHERE id = :id AND deleted_at IS NULL',
            id=user_id,
        )

    async def email_exists(self, email: str) -> bool:
        row = await sql.fetch_one(
            self.session, 'SELECT 1 FROM "user" WHERE lower(email) = lower(:email)', email=email
        )
        return row is not None

    async def create(self, *, email: str, password_hash: str, account_state: str) -> str:
        user_id = cuid()
        try:
            await sql.execute(
                self.session,
                'INSERT INTO "user"(id, email, password_hash, account_state, created_by)'
                " VALUES (:id, :email, :ph, :state, :id)",
                id=user_id,
                email=email,
                ph=password_hash,
                state=account_state,
            )
        except IntegrityError as exc:  # uq_user_email race — surface a friendly 409, not a 500
            raise AppError(
                "email_taken", "An account with this email already exists", status_code=409
            ) from exc
        return user_id

    async def assign_role(self, user_id: str, role_code: str) -> None:
        await sql.execute(
            self.session,
            "INSERT INTO user_role(id, user_id, role_id)"
            " SELECT :rid, :uid, r.id FROM role r WHERE r.code = :code"
            " ON CONFLICT DO NOTHING",
            rid=cuid(),
            uid=user_id,
            code=role_code,
        )

    async def get_role_codes(self, user_id: str) -> list[str]:
        rows = await sql.fetch_all(
            self.session,
            "SELECT r.code FROM user_role ur JOIN role r ON r.id = ur.role_id"
            " WHERE ur.user_id = :uid ORDER BY r.code",
            uid=user_id,
        )
        return [row[0] for row in rows]

    async def set_account_state(self, user_id: str, state: str) -> None:
        await sql.execute(
            self.session,
            'UPDATE "user" SET account_state = :state WHERE id = :id',
            state=state,
            id=user_id,
        )

    async def set_password_hash(self, user_id: str, password_hash: str) -> None:
        await sql.execute(
            self.session,
            'UPDATE "user" SET password_hash = :ph WHERE id = :id',
            ph=password_hash,
            id=user_id,
        )

    async def bump_token_version(self, user_id: str) -> None:
        """Invalidate every outstanding access token for the user (S3.35)."""
        await sql.execute(
            self.session,
            'UPDATE "user" SET token_version = token_version + 1 WHERE id = :id',
            id=user_id,
        )

    # ---- MFA (TOTP) ----
    async def get_mfa(self, user_id: str):
        """Return (mfa_secret_enc, mfa_enabled, mfa_recovery_enc) for the user."""
        return await sql.fetch_one(
            self.session,
            'SELECT mfa_secret_enc, mfa_enabled, mfa_recovery_enc FROM "user"'
            " WHERE id = :id AND deleted_at IS NULL",
            id=user_id,
        )

    async def set_mfa_pending(self, user_id: str, *, secret_enc: str, recovery_enc: str) -> None:
        """Store a freshly-generated (not yet activated) TOTP secret + recovery codes."""
        await sql.execute(
            self.session,
            'UPDATE "user" SET mfa_secret_enc = :secret, mfa_recovery_enc = :rec,'
            " mfa_enabled = false WHERE id = :id",
            secret=secret_enc,
            rec=recovery_enc,
            id=user_id,
        )

    async def enable_mfa(self, user_id: str) -> None:
        await sql.execute(
            self.session, 'UPDATE "user" SET mfa_enabled = true WHERE id = :id', id=user_id
        )

    async def clear_mfa(self, user_id: str) -> None:
        """Turn MFA off and forget the secret and the recovery codes (ST-2.1).

        The secret is cleared, not just the flag: leaving a live TOTP secret on a disabled account
        keeps a credential nobody is watching. Re-enabling starts a fresh enrolment.
        """
        await sql.execute(
            self.session,
            'UPDATE "user" SET mfa_enabled = false, mfa_secret_enc = NULL,'
            " mfa_recovery_enc = NULL WHERE id = :id",
            id=user_id,
        )

    async def set_mfa_recovery(self, user_id: str, recovery_enc: str) -> None:
        """Persist the remaining recovery codes after one is consumed."""
        await sql.execute(
            self.session,
            'UPDATE "user" SET mfa_recovery_enc = :rec WHERE id = :id',
            rec=recovery_enc,
            id=user_id,
        )


class RefreshTokenRepository(BaseRepository):
    async def create_family(self, user_id: str) -> str:
        family_id = cuid()
        await sql.execute(
            self.session,
            "INSERT INTO refresh_token_family(id, user_id) VALUES (:id, :uid)",
            id=family_id,
            uid=user_id,
        )
        return family_id

    async def create_token(self, *, family_id: str, token_hash: str, ttl_seconds: int) -> str:
        token_id = cuid()
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        await sql.execute(
            self.session,
            "INSERT INTO refresh_token(id, family_id, token_hash, expires_at)"
            " VALUES (:id, :fid, :hash, :exp)",
            id=token_id,
            fid=family_id,
            hash=token_hash,
            exp=expires_at,
        )
        return token_id

    async def get_token_by_hash(self, token_hash: str):
        return await sql.fetch_one(
            self.session,
            "SELECT rt.id, rt.family_id, rt.used_at, rt.expires_at, f.user_id, f.revoked_at"
            " FROM refresh_token rt JOIN refresh_token_family f ON f.id = rt.family_id"
            " WHERE rt.token_hash = :hash",
            hash=token_hash,
        )

    async def mark_used(self, token_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE refresh_token SET used_at = now() WHERE id = :id AND used_at IS NULL",
            id=token_id,
        )

    async def revoke_family(self, family_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE refresh_token_family SET revoked_at = now()"
            " WHERE id = :id AND revoked_at IS NULL",
            id=family_id,
        )

    async def revoke_all_for_user(self, user_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE refresh_token_family SET revoked_at = now()"
            " WHERE user_id = :uid AND revoked_at IS NULL",
            uid=user_id,
        )


class RbacRepository(BaseRepository):
    async def get_permissions_for_role(self, role_code: str) -> set[str]:
        """The permission codes granted to a role (the seeded role→permission map, S3.21)."""
        rows = await sql.fetch_all(
            self.session,
            "SELECT p.code FROM role r"
            " JOIN role_permission rp ON rp.role_id = r.id"
            " JOIN permission p ON p.id = rp.permission_id"
            " WHERE r.code = :code",
            code=role_code,
        )
        return {row[0] for row in rows}


class ConsentRepository(BaseRepository):
    async def valid_purposes(self) -> set[str]:
        rows = await sql.fetch_all(self.session, "SELECT code FROM lk_consent_purpose")
        return {row[0] for row in rows}

    async def record(self, *, user_id: str, purpose: str, wording_version: str) -> None:
        await sql.execute(
            self.session,
            "INSERT INTO consent_record(id, user_id, purpose, wording_version, channel)"
            " VALUES (:id, :uid, :purpose, :wv, 'WEB')",
            id=cuid(),
            uid=user_id,
            purpose=purpose,
            wv=wording_version,
        )


class AuthTokenRepository(BaseRepository):
    """Single-use, expiring email-verify / password-reset tokens (only the hash is stored)."""

    async def create(self, *, user_id: str, kind: str, token_hash: str, ttl_seconds: int) -> str:
        token_id = cuid()
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        await sql.execute(
            self.session,
            "INSERT INTO auth_token(id, user_id, kind, token_hash, expires_at)"
            " VALUES (:id, :uid, :kind, :hash, :exp)",
            id=token_id,
            uid=user_id,
            kind=kind,
            hash=token_hash,
            exp=expires_at,
        )
        return token_id

    async def get_active_by_hash(self, token_hash: str, kind: str):
        """Return (id, user_id, expires_at, used_at) for a token of this kind, or None."""
        return await sql.fetch_one(
            self.session,
            "SELECT id, user_id, expires_at, used_at FROM auth_token"
            " WHERE token_hash = :hash AND kind = :kind",
            hash=token_hash,
            kind=kind,
        )

    async def mark_used(self, token_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE auth_token SET used_at = now() WHERE id = :id AND used_at IS NULL",
            id=token_id,
        )


class AuditRepository(BaseRepository):
    async def write(
        self,
        *,
        actor_user_id: str | None,
        action: str,
        resource_type: str,
        resource_id: str | None,
        request_id: str,
        detail: dict | None = None,
    ) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO audit_log(id, actor_user_id, action, resource_type, resource_id,"
            " request_id, detail) VALUES (:id, :actor, :action, :rtype, :rid, :req, :detail)",
            id=cuid(),
            actor=actor_user_id,
            action=action,
            rtype=resource_type,
            rid=resource_id,
            req=request_id,
            detail=json.dumps(detail) if detail is not None else None,
        )
