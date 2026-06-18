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


# --------- field_flag annotation checks (D-016 / D-017) — income is annotated, never judged ------


def _flag(**check):
    base = {"id": "f", "type": "field_flag", "severity": "review_flag", "label": "flag fired"}
    base.update(check)
    return {"checks": [base]}


def _facts(**fields):
    return Facts(frozenset(), has_motivation=False, fields=fields)


def test_field_flag_fires_as_annotation_not_a_return():
    """An income/decline flag surfaces to the human — it NEVER returns or rejects (§5.7, D-010)."""
    rules = _flag(field="household_income_band", flag_values=["GT_600K"])
    out = evaluate(rules, _facts(household_income_band="GT_600K"))
    assert out.outcome == READY
    assert out.fix_list == []
    assert "flag fired" in out.annotations


def test_field_flag_silent_when_value_not_flagged():
    rules = _flag(field="household_income_band", flag_values=["GT_600K"])
    out = evaluate(rules, _facts(household_income_band="LTE_350K"))
    assert out.outcome == READY
    assert out.annotations == []


def test_field_flag_missing_field_is_silent():
    rules = _flag(field="household_income_band", flag_values=["GT_600K"])
    assert evaluate(rules, _facts()).annotations == []


def test_field_flag_compound_also_condition():
    """D-016 redirect: private bursary dropped AND still NSFAS-eligible (≤ R350k)."""
    rules = _flag(
        field="prior_funder",
        flag_values=["OTHER_BURSARY"],
        also=[{"field": "household_income_band", "in": ["SASSA_GRANT", "LTE_350K"]}],
    )
    fires = _facts(prior_funder="OTHER_BURSARY", household_income_band="LTE_350K")
    assert "flag fired" in evaluate(rules, fires).annotations
    # same prior funder but income above the line → the `also` condition fails → silent.
    silent = _facts(prior_funder="OTHER_BURSARY", household_income_band="GT_600K")
    assert evaluate(rules, silent).annotations == []


def test_nsfas_means_income_is_an_annotation():
    rules = _flag(field="nsfas_decline_reason", flag_values=["MEANS_INCOME"])
    out = evaluate(rules, _facts(nsfas_decline_reason="MEANS_INCOME"))
    assert out.outcome == READY
    assert "flag fired" in out.annotations


def test_required_doc_and_income_flag_coexist():
    """Postgrad shape (D-017): missing income proof RETURNS; the ceiling flag still shows."""
    rules = {
        "checks": [
            {"id": "acc", "type": "document_present", "doc_type": "ACCEPTANCE_LETTER",
             "severity": "required", "label": "Acceptance letter present"},
            {"id": "inc", "type": "document_present", "doc_type": "PROOF_OF_INCOME",
             "severity": "required", "label": "Proof of income present"},
            {"id": "ceil", "type": "field_flag", "field": "household_income_band",
             "flag_values": ["GT_600K"], "severity": "review_flag",
             "label": "income above ceiling"},
        ]
    }
    facts = Facts(frozenset({"ACCEPTANCE_LETTER"}), has_motivation=False,
                  fields={"household_income_band": "GT_600K"})
    out = evaluate(rules, facts)
    assert out.outcome == RETURNED  # missing required income proof
    assert "Proof of income present" in out.fix_list
    assert "income above ceiling" in out.annotations  # flag still surfaced for the human
