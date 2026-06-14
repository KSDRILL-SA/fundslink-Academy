#!/usr/bin/env bash
# Restore drill #1 (Stage 01, DB-D36) — prove the backup is restorable AND that the
# restored database still enforces every constraint.
#
#   pg_dump (source) -> drop/create (restore target) -> pg_restore -> run the DB-D37
#   constraint suite against the restored copy. Each phase is timed; results append to
#   docs/operations/restore-drill-log.md.
#
# Config via env (defaults suit the local dev cluster):
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=fundslink PGPASSWORD=...
#   SRC_DB=fundslink RESTORE_DB=fundslink_restore
#   PGBIN=/path/to/postgres/bin   (optional; else tools must be on PATH)
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-fundslink}"
SRC_DB="${SRC_DB:-fundslink}"
RESTORE_DB="${RESTORE_DB:-fundslink_restore}"
PGBIN_PREFIX="${PGBIN:+$PGBIN/}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$ROOT/docs/operations/restore-drill-log.md"
DUMP="$(mktemp -t fundslink_drill_XXXX.dump)"
export PGHOST PGPORT PGUSER

PGDUMP="${PGBIN_PREFIX}pg_dump"
PGRESTORE="${PGBIN_PREFIX}pg_restore"
CREATEDB="${PGBIN_PREFIX}createdb"
DROPDB="${PGBIN_PREFIX}dropdb"

now_ms() { python -c "import time; print(int(time.time()*1000))"; }

t0=$(now_ms)
echo "[drill] dumping $SRC_DB ..."
"$PGDUMP" -Fc -d "$SRC_DB" -f "$DUMP"
t1=$(now_ms)

echo "[drill] recreating $RESTORE_DB ..."
"$DROPDB" --if-exists "$RESTORE_DB"
"$CREATEDB" "$RESTORE_DB"
t2=$(now_ms)

echo "[drill] restoring into $RESTORE_DB ..."
"$PGRESTORE" -d "$RESTORE_DB" "$DUMP"
t3=$(now_ms)

echo "[drill] running constraint suite against $RESTORE_DB ..."
RESTORE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${RESTORE_DB}"
set +e
( cd "$ROOT/apps/api" && ALEMBIC_DATABASE_URL="$RESTORE_URL" DATABASE_URL="$RESTORE_URL" \
    python -m pytest tests/db -q )
SUITE_RC=$?
set -e
t4=$(now_ms)

rm -f "$DUMP"

dump_s=$(awk "BEGIN{printf \"%.2f\", ($t1-$t0)/1000}")
recreate_s=$(awk "BEGIN{printf \"%.2f\", ($t2-$t1)/1000}")
restore_s=$(awk "BEGIN{printf \"%.2f\", ($t3-$t2)/1000}")
suite_s=$(awk "BEGIN{printf \"%.2f\", ($t4-$t3)/1000}")
total_s=$(awk "BEGIN{printf \"%.2f\", ($t4-$t0)/1000}")
verdict=$([ $SUITE_RC -eq 0 ] && echo "PASS ✅ — restored DB enforces all constraints" || echo "FAIL ❌")

mkdir -p "$(dirname "$LOG")"
{
  echo ""
  echo "## Restore drill — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "| Phase | Seconds |"
  echo "|-------|---------|"
  echo "| pg_dump ($SRC_DB) | $dump_s |"
  echo "| drop + create ($RESTORE_DB) | $recreate_s |"
  echo "| pg_restore | $restore_s |"
  echo "| constraint suite (DB-D37) | $suite_s |"
  echo "| **total** | **$total_s** |"
  echo ""
  echo "**Result:** $verdict (constraint suite rc=$SUITE_RC)."
} >> "$LOG"

# Drop the restored DB so the cluster-global app role keeps no cross-DB grant dependency.
"$DROPDB" --if-exists "$RESTORE_DB" 2>/dev/null || true

echo "[drill] done in ${total_s}s — suite rc=$SUITE_RC — log: $LOG"
exit $SUITE_RC
