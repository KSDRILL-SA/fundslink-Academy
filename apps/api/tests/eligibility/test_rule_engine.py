"""Pure unit tests for the pre-screening evaluator (MASTER-SPEC §5.7) — no DB, no IO."""

from __future__ import annotations

from app.modules.eligibility.rule_engine import READY, RETURNED, Facts, evaluate


def _doc_check(severity="required"):
    return {
        "checks": [
            {
                "id": "nsfas",
                "type": "document_present",
                "doc_type": "NSFAS_OUTCOME",
                "severity": severity,
                "label": "NSFAS outcome evidence present",
            }
        ]
    }


def test_all_required_present_is_ready():
    out = evaluate(_doc_check(), Facts(frozenset({"NSFAS_OUTCOME"}), has_motivation=False))
    assert out.outcome == READY
    assert out.fix_list == []


def test_missing_required_returns_with_itemized_fix_list():
    out = evaluate(_doc_check(), Facts(frozenset(), has_motivation=False))
    assert out.outcome == RETURNED
    assert "NSFAS outcome evidence present" in out.fix_list  # itemized, kind fix-list


def test_advisory_failure_is_an_annotation_never_a_failure():
    """A non-required discrepancy is annotated for the human — it never auto-returns (§5.7)."""
    out = evaluate(_doc_check(severity="advisory"), Facts(frozenset(), has_motivation=False))
    assert out.outcome == READY
    assert out.fix_list == []
    assert "NSFAS outcome evidence present" in out.annotations


def test_unknown_check_type_never_blocks_the_student():
    rules = {"checks": [{"id": "x", "type": "judge_quality", "severity": "required", "label": "?"}]}
    out = evaluate(rules, Facts(frozenset(), has_motivation=False))
    assert out.outcome == READY  # the engine never blocks on a check it doesn't understand


def test_motivation_present_check():
    rules = {
        "checks": [
            {"id": "m", "type": "motivation_present", "severity": "required", "label": "Motivation"}
        ]
    }
    assert evaluate(rules, Facts(frozenset(), has_motivation=True)).outcome == READY
    assert evaluate(rules, Facts(frozenset(), has_motivation=False)).outcome == RETURNED


def test_empty_ruleset_is_ready():
    assert evaluate({}, Facts(frozenset(), has_motivation=False)).outcome == READY
