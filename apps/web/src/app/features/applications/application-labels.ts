/**
 * Human words for the contract's application codes.
 *
 * One table, because three screens were each carrying their own copy of it —
 * the dashboard, the applications list and the review queue — and the moment
 * two of them disagree, a student and the reviewer reading their application
 * are looking at different names for the same thing.
 *
 * The keys are `ApplicationInput.application_type` from the contract. An
 * unrecognised code is deliberately NOT handled here: each caller falls back to
 * a neutral phrase, because the backend can add a category before this bundle
 * is redeployed and a blank is worse than a general word.
 *
 * Level labels live here for the same reason (`StudentProfileInput.level`).
 */
export const APPLICATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  POSTGRAD: 'Postgraduate funding',
  UG_CAT_A: 'Undergraduate — category A',
  UG_CAT_B: 'Undergraduate — category B',
  UG_CAT_C: 'Undergraduate — category C',
  OTHER: 'Funding application',
};

/**
 * Household income bands, as the contract defines them.
 *
 * The figures are part of the enum's meaning — `MISSING_MIDDLE_350_600K` *is*
 * the R350 000–R600 000 band — so writing them here is translating a contract
 * value, not inventing a business rule. That distinction is why they live in
 * this file rather than in a template: a rand figure typed into a screen is
 * indistinguishable from a fabricated one, and the account-data-integrity gate
 * refuses it there on purpose.
 *
 * If the bands themselves ever change, they change in `openapi.yaml` first and
 * this table follows.
 */
export const INCOME_BAND_LABELS: Readonly<Record<string, string>> = {
  LTE_350K: 'Up to R350 000',
  MISSING_MIDDLE_350_600K: 'R350 000 to R600 000',
  GT_600K: 'More than R600 000',
};

export const STUDY_LEVEL_LABELS: Readonly<Record<string, string>> = {
  UG: 'Undergraduate',
  HONOURS: 'Honours',
  MASTERS: "Master's",
  PHD: 'PhD',
  PGDIP: 'Postgraduate diploma',
};
