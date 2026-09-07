/**
 * Draft persistence for the OTHER motivation (S12).
 *
 * P8 requires drafts to survive, and P6 says why it matters here more than
 * anywhere: someone writing the hardest paragraph of their life, on a phone,
 * on data they paid for. A dropped connection, a browser reaping a background
 * tab, or an accidental back-swipe must not cost them the paragraph.
 *
 * `localStorage`, deliberately, and not the server: this text is
 * unsubmitted and personal, and posting every keystroke to an API would mean
 * the platform holding a half-written account of someone's circumstances that
 * they never chose to send. It stays on their device until they submit.
 *
 * Every access is wrapped. Private mode, a full quota and a blocked-storage
 * browser all throw, and none of them is a reason to stop someone writing.
 */
export interface MotivationDraft {
  situation: string;
  why_not_categories: string;
  support_needed: string;
  language: string;
}

const KEY = 'fl-motivation-draft';

export const EMPTY_DRAFT: MotivationDraft = {
  situation: '',
  why_not_categories: '',
  support_needed: '',
  language: 'en',
};

export function readDraft(storage: Storage | undefined): MotivationDraft {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) {
      return { ...EMPTY_DRAFT };
    }
    const parsed = JSON.parse(raw) as Partial<MotivationDraft>;
    // Field-by-field, never a spread of whatever was in storage: the value is
    // user-writable and a stale or tampered shape must not reach the form.
    return {
      situation: typeof parsed.situation === 'string' ? parsed.situation : '',
      why_not_categories:
        typeof parsed.why_not_categories === 'string' ? parsed.why_not_categories : '',
      support_needed: typeof parsed.support_needed === 'string' ? parsed.support_needed : '',
      language: typeof parsed.language === 'string' ? parsed.language : 'en',
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function writeDraft(storage: Storage | undefined, draft: MotivationDraft): void {
  try {
    storage?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage is full, blocked, or unavailable. The draft is not saved, and
    // that is not a reason to interrupt someone mid-sentence — the form still
    // works, it simply will not survive a reload.
  }
}

export function clearDraft(storage: Storage | undefined): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to do. A leftover draft is harmless; a thrown error here is not.
  }
}

/** Any of the official South African languages (E11, P7). */
export const SA_LANGUAGES: readonly { value: string; label: string }[] = [
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
];
