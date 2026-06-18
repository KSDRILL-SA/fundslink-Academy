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

from collections.abc import Mapping
from dataclasses import dataclass, field

READY = "READY"
RETURNED = "RETURNED"


@dataclass(frozen=True)
class Facts:
    """What the engine knows about an application at screen time."""

    document_types: frozenset[str]
    has_motivation: bool
    # Self-declared application fields the engine may *annotate* on (D-016/D-017): income band,
    # NSFAS decline reason, prior funder. Never a gate — only fuels review_flag annotations.
    fields: Mapping[str, str | None] = field(default_factory=dict)


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
    if kind == "field_flag":
        # A config-driven ANNOTATION check (D-016/D-017): the flag "fires" when the field is in
        # flag_values AND every optional `also` condition holds. A fired flag is modelled as
        # passed=False so the existing annotation path surfaces it to the human — it NEVER joins
        # the fix-list (these checks always carry a non-"required" severity, e.g. review_flag).
        # No income/means JUDGEMENT happens here: we surface the declared band; the human decides.
        fired = facts.fields.get(check.get("field")) in set(check.get("flag_values", []))
        for cond in check.get("also", []):
            fired = fired and facts.fields.get(cond.get("field")) in set(cond.get("in", []))
        return not fired
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
