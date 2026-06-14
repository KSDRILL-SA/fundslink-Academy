# Restore Drill Log — FundsLink Academy

> **What this proves (DB-D36 / implementation-process §3, task 7):** the database backup
> is restorable *and* the restored copy still enforces every constraint and trigger — a
> backup you have never restored is a hope, not a backup. Each entry below was produced by
> `scripts/restore_drill.sh`: `pg_dump → drop → create → pg_restore → DB-D37 constraint
> suite against the restored database`.

Run it with: `make restore-drill` (or `bash scripts/restore_drill.sh`).

## Restore drill — 2026-06-13T23:41:57Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 4.29 |
| drop + create (fundslink_restore) | 7.17 |
| pg_restore | 7.83 |
| constraint suite (DB-D37) | 46.47 |
| **total** | **65.75** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).
