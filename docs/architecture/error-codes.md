# Error Code Registry — the stable `error.code` contract

| Attribute | Value |
|-----------|-------|
| **Status** | Living (append when a new `AppError` code ships) |
| **Owner** | Backend (Engineer 02); Founder (L4) ratifies breaking renames |
| **Reads with** | `packages/contracts/openapi.yaml` (the `Error` schema + `Conflict`/`Forbidden`/`NotFound` responses) |
| **Rule** | The frontend branches on **`error.code`** — never on `error.message` (S4.12). Codes are **stable** and **`lower_snake_case`**. |

Every business error is an `AppError(code, message, status_code)` rendered as a uniform envelope
(`app/common/errors.py`): `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`.
`message` is human-facing and may change or be localised; **`code` is the API contract** and does not.

## Convention (H8 — ST-3.7 stability sweep)
- `code` is always `lower_snake_case`. *(The lone outlier `APPLICATION_ALREADY_ACTIVE` was renamed
  to `application_already_active` in this sweep so the frontend never has to special-case casing.)*
- A code, once shipped, is **never silently renamed** — a rename is a breaking contract change and
  needs Founder (L4) sign-off.
- `5xx` responses use the uniform 500 envelope and carry no business `code` (nothing to branch on).

## Registry

| `error.code` | HTTP | Meaning / when |
|--------------|------|----------------|
| `unauthorized` | 401 | No / invalid session (not authenticated) |
| `invalid_credentials` | 401 | Login: wrong email or password (no user/pw distinction — anti-enumeration) |
| `invalid_token` | 401 | Refresh/verify/reset token invalid or expired |
| `mfa_required` | 401 | Step-up required for a privileged action |
| `mfa_invalid_code` | 401 | TOTP code wrong / replayed |
| `mfa_not_enrolled` | 409 | MFA action attempted before enrolment |
| `forbidden` | 403 | Authenticated but lacks the required permission |
| `password_breached` | 422 | HIBP k-anonymity match on the chosen password |
| `email_taken` | 409 | Registration: email already registered |
| `rate_limited` | 429 | Throttled (login / expensive endpoint) — see `Retry-After` |
| `profile_not_found` | 404 | No profile created yet |
| `profile_required` | 409 | Action needs a profile first (apply, upload) |
| `id_number_taken` | 409 | SA ID already registered to another user (BR-A04) |
| `invalid_consent_purpose` | 422 | Unknown consent purpose |
| `sa_id_required` | 409 | SUBMIT blocked: no SA ID on file (D-007) |
| `application_not_found` | 404 | Application absent or not the caller's (RLS → 404, never data) |
| `application_already_active` | 409 | One active application per academic year (D-004 / BR-E06) |
| `invalid_transition` | 409 | Illegal application status change (BR-S04) |
| `invalid_application` | 422 | Document references an application the caller doesn't own |
| `invalid_document` | 422 | Unknown document type / bad reference |
| `empty_file` | 422 | Upload had no bytes |
| `unsupported_media_type` | 415 | Upload not an allowed type (ST-2.4 magic-byte allowlist) |
| `payload_too_large` | 413 | Upload over the size cap (ST-2.4) |
| `appeal_exists` | 409 | One appeal per decided application (BR-E07) |
| `human_final_required` | 409 | A final decision was attempted by a non-human actor (BR-E03 / D-010) |
| `bursary_not_found` | 404 | Matching/tracking: bursary id absent |
| `already_tracked` | 409 | External bursary already on the student's tracker |
| `tracked_not_found` | 404 | Tracked external application absent or not the caller's |

> If you add an `AppError`, add its row here in the same PR. The frontend's typed error handling
> is generated from this list — an undocumented code is an unhandled code.
