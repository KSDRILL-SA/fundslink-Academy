# FUNDSLINK ACADEMY — RUNBOOK: JWT Key Rotation (RS256) | v1.0 [ST-2.9]
**Cadence:** every 90 days, or immediately on suspected compromise.

```mermaid
sequenceDiagram
  participant OPS as Operator
  participant ENV as Railway env
  participant JWKS as JWKS endpoint
  participant API as FastAPI
  OPS->>ENV: generate keypair · store private as KEY_NEXT (never in repo)
  OPS->>JWKS: publish BOTH public keys (old kid + new kid) · deploy
  OPS->>ENV: flip KEY_ACTIVE to new kid
  Note over API: 15-min access tokens · 24h overlap window
  OPS->>JWKS: after 24h — remove old public key · delete old private key
  OPS->>API: verify old-kid REJECTED · new-kid accepted · log to audit_log (SYSTEM)
  alt suspected compromise
    OPS->>API: skip overlap — revoke all refresh families · flush Redis deny-list · force re-login
  end
```

1. Generate new keypair offline; store private key in Railway env as KEY_NEXT (never in repo).
2. Publish BOTH public keys at JWKS endpoint (old kid + new kid). Deploy.
3. Flip signing to new kid (env KEY_ACTIVE). Access tokens are 15-min — overlap window 24h is generous.
4. After 24h: remove old public key from JWKS; delete old private key everywhere.
5. Compromise path: skip overlap — flip immediately, revoke ALL refresh-token families (forced re-login), Redis deny-list flush-and-rebuild, notify users, incident post-mortem.
6. Verify: staging token signed with old kid is REJECTED post-removal; new kid accepted. Log rotation in audit_log (SYSTEM principal).
