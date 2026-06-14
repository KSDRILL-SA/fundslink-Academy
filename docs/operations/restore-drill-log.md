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

## Restore drill — 2026-06-14T01:15:14Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 2.06 |
| drop + create (fundslink_restore) | 5.18 |
| pg_restore | 4.48 |
| constraint suite (DB-D37) | 25.21 |
| **total** | **36.92** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).

## Restore drill — 2026-06-14T02:03:24Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 1.65 |
| drop + create (fundslink_restore) | 5.09 |
| pg_restore | 3.69 |
| constraint suite (DB-D37) | 28.21 |
| **total** | **38.65** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).

## Restore drill — 2026-06-14T02:55:34Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 1.88 |
| drop + create (fundslink_restore) | 6.56 |
| pg_restore | 4.35 |
| constraint suite (DB-D37) | 25.89 |
| **total** | **38.67** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).

## Restore drill — 2026-06-14T03:38:38Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 3.09 |
| drop + create (fundslink_restore) | 3.94 |
| pg_restore | 6.67 |
| constraint suite (DB-D37) | 27.66 |
| **total** | **41.36** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).

## Restore drill — 2026-06-14T04:03:49Z

| Phase | Seconds |
|-------|---------|
| pg_dump (fundslink) | 2.09 |
| drop + create (fundslink_restore) | 2.81 |
| pg_restore | 5.88 |
| constraint suite (DB-D37) | 58.43 |
| **total** | **69.21** |

**Result:** PASS ✅ — restored DB enforces all constraints (constraint suite rc=0).
