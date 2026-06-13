# governance/

The KSDRILL constitutional framework (C0–C10) is **vendored here at a pinned SHA**, not
copied into git and not a submodule (ADR-002 §4). Precedence: these constitutions sit at the
top of the conflict-resolution order (see [docs/README.md](../docs/README.md)).

- `GOVERNANCE_VERSION` — the pinned repo + commit SHA (committed).
- `sync.sh` — pulls `system-design-template` at that SHA into `governance/system-design-template/` (gitignored).

```bash
bash governance/sync.sh   # after setting GOVERNANCE_SHA in GOVERNANCE_VERSION
```

> A solo working clone for live sessions also exists at `.ksdrill/` (gitignored) — that is the
> engineer's read copy; this vendored, pinned copy is the repo's reproducible governance anchor.
