/**
 * The facts about the organisation, in exactly one place.
 *
 * Two rules govern this file.
 *
 * **Nothing here may be invented.** A registration number, a review turnaround
 * in days, a funding total — on a platform that asks students for their ID
 * numbers and their hardship, a fabricated credential is not a placeholder, it
 * is a lie a vulnerable person may act on. Anything not yet true is `null`, and
 * the pages are written to read correctly when it is.
 *
 * **Anything marked PLACEHOLDER is the Founder's to replace before launch.**
 * They are addresses that make a route concrete; they are not confirmed.
 */
export const ORGANISATION = {
  name: 'FundsLink Academy',
  country: 'South Africa',

  /**
   * The positioning line, used in the hero, the footer and the meta
   * description.
   *
   * Deliberately says nothing about any other funder. An earlier wording
   * described students who "fall through the NSFAS gap", which reads as a
   * comparison — and a student or a partner could reasonably take it as this
   * platform setting itself against the national scheme. It never was: this
   * funds what other funding does not reach, alongside it.
   */
  positioning: 'Bursary funding for South African students whose studies are not fully covered.',

  /** PLACEHOLDER — general enquiries. */
  generalEmail: 'hello@fundslink.academy',
  /** PLACEHOLDER — data protection and POPIA requests (also used by S21). */
  privacyEmail: 'privacy@fundslink.academy',

  /**
   * The designated Information Officer under POPIA.
   *
   * `null` until the Founder designates one. The privacy page states the
   * position plainly rather than naming nobody, because POPIA requires the
   * officer to be reachable and a made-up name would defeat that entirely.
   */
  informationOfficer: null as { name: string; email: string } | null,

  /**
   * Non-profit registration: NPC number, PBO number, §18A status.
   *
   * `null` until registered. The design package marks these "once live"; a
   * donor deciding whether to give must never be shown a number that does not
   * exist at SARS or the CIPC.
   */
  registration: null as { npc: string; pbo: string; section18a: boolean } | null,
} as const;
