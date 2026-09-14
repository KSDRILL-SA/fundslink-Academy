/**
 * The eleven official languages of South Africa (E11, P7, D-008).
 *
 * Two screens ask about language and they must offer the same list in the same order: the
 * motivation ("write in the language you think in") and the profile ("which language should we
 * write to you in"). The codes match `student_profile.ck_sp_language` and the contract enum, so a
 * choice made here is one the API and the database already accept.
 *
 * Each label is the language's own name, not its English one — isiZulu, not "Zulu". Ordered by
 * that name, which is why Sepedi follows isiZulu rather than sitting under N.
 */
export const SA_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'nr', label: 'isiNdebele' },
  { value: 'xh', label: 'isiXhosa' },
  { value: 'zu', label: 'isiZulu' },
  { value: 'nso', label: 'Sepedi' },
  { value: 'st', label: 'Sesotho' },
  { value: 'tn', label: 'Setswana' },
  { value: 'ss', label: 'siSwati' },
  { value: 've', label: 'Tshivenda' },
  { value: 'ts', label: 'Xitsonga' },
] as const satisfies readonly { value: string; label: string }[];

/** The codes themselves — the same union the contract's `preferred_language` enum declares,
 *  so a mismatch between this list and the API is a compile error rather than a 422. */
export type SaLanguage = (typeof SA_LANGUAGES)[number]['value'];
