-- Downgrade 0017 — remove the v2 rulesets; v1 remains effective again for new screens.
-- Safe: pre_screen_result.ruleset_id is set at screen time; removing an unused future version does
-- not orphan a screened application (those pin v1 or a still-present version).
DELETE FROM eligibility_ruleset WHERE id IN ('ers_ug_cat_c_v2','ers_postgrad_v2');
