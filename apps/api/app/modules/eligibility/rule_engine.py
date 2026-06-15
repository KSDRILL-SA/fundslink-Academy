"""Pre-screening rule evaluator (MASTER-SPEC §5.7) — pure, deterministic, config-driven.

The engine has exactly one power: check that the small necessary requirements per category are
present, and return an itemized, kind fix-list when they are not. It is NEVER a decision-maker
(BR-E03) and it never judges motivation quality. A *required* check that fails contributes to the
fix-list (→ RETURNED, never a rejection); a non-required check that fails is an **annotation** for
the human reviewer, never an auto-failure (§5.7). An unknown check type never blocks a student.

No DB, no IO — given the ruleset JSON + the gathered facts, it returns the outcome. That makes the
whole policy unit-testable and keeps "engine down ⇒ UNSCREENED" a concern of the service, not here.
"""

from __future__ import annotations

from dataclasses import dataclass, field

READY = "READY"
RETURNED = "RETURNED"


@dataclass(frozen=True)
class Facts:
    """What the engine knows about an application at screen time."""

    document_types: frozenset[str]
    has_motivation: bool


@dataclass
class PreScreenOutcome:
    outcome: str  # READY | RETURNED
    results: list[dict] = field(default_factory=list)
    fix_list: list[str] = field(default_factory=list)
    annotations: list[str] = field(default_factory=list)


def _check_passes(check: dict, facts: Facts) -> bool | None:
    """True/False for a known check; None for an unknown type (treated as non-blocking)."""
    kind = check.get("type")
    if kind == "document_present":
        return check.get("doc_type") in facts.document_types
    if kind == "motivation_present":
        return facts.has_motivation
    return None  # unknown check type — never block the student on engine confusion


def evaluate(rules: dict, facts: Facts) -> PreScreenOutcome:
    """Evaluate a ruleset's checks against the facts. Required failures → fix-list (→ RETURNED)."""
    out = PreScreenOutcome(outcome=READY)
    for check in rules.get("checks", []):
        severity = check.get("severity", "required")
        label = check.get("label", check.get("id", "requirement"))
        passed = _check_passes(check, facts)
        out.results.append(
            {"id": check.get("id"), "label": label, "severity": severity, "passed": passed}
        )
        if passed is False:
            if severity == "required":
                out.fix_list.append(label)
            else:
                out.annotations.append(label)  # advisory discrepancy — never an auto-failure
    if out.fix_list:
        out.outcome = RETURNED
    return out
