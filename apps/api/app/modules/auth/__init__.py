"""Auth module (C3) — RS256 JWT, split-token sessions, RBAC, MFA, account state machine.

Layering (CLAUDE.md / S4.79): router -> service -> repository; only repository.py touches a
DB driver (import-linter enforces). The helpers here (jwt, passwords, tokens, ratelimit) are
pure primitives with no DB dependency.
"""
