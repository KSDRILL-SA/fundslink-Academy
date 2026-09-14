/**
 * The six themes of an OTHER-category case — MASTER-SPEC §5.6, D-018.
 *
 * The codes are `lk_theme_tag`, seeded since migration 0001; the labels are what a reviewer
 * actually reads. Short on purpose: §5.6 promotes a recurring theme to a real funding category,
 * and if every case can invent its own theme then nothing ever recurs and nothing is ever
 * promoted.
 *
 * Worded as what happened to the applicant, not as a verdict on them. A reviewer ticking
 * "Their family's circumstances changed" is recording a fact about a year; "FAMILY_CRISIS" as a
 * label on a person is not the same sentence.
 */
export const THEME_TAGS = [
  { value: 'FINANCIAL_GAP', label: 'A funding gap no category covers' },
  { value: 'FAMILY_CRISIS', label: "Their family's circumstances changed" },
  { value: 'HEALTH', label: 'Health, theirs or a dependant’s' },
  { value: 'DOCUMENTATION', label: 'They cannot get the documents asked for' },
  { value: 'INSTITUTIONAL', label: 'Something the institution did or would not do' },
  { value: 'OTHER', label: 'Something else again' },
] as const satisfies readonly { value: string; label: string }[];

export type ThemeTagValue = (typeof THEME_TAGS)[number]['value'];
