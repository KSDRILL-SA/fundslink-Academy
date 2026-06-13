#!/usr/bin/env bash
# Vendor the KSDRILL governance constitutions (C0–C10) at a pinned SHA.
# ADR-002 §4: a pinned, reproducible pull — not a git submodule.
# The vendored copy (governance/system-design-template/) is gitignored.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/GOVERNANCE_VERSION"

TARGET="$HERE/system-design-template"

if [ "${GOVERNANCE_SHA}" = "<PINNED_SHA>" ]; then
  echo "ERROR: set GOVERNANCE_SHA in governance/GOVERNANCE_VERSION to a real commit SHA first." >&2
  exit 1
fi

echo "Vendoring ${GOVERNANCE_REPO} @ ${GOVERNANCE_SHA} -> ${TARGET}"
rm -rf "$TARGET"
git clone --quiet "$GOVERNANCE_REPO" "$TARGET"
git -C "$TARGET" checkout --quiet "$GOVERNANCE_SHA"
rm -rf "$TARGET/.git"
echo "Governance vendored at ${GOVERNANCE_SHA}."
