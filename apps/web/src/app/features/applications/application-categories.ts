import { BookOpen, GraduationCap, MessageSquareText, Receipt, ShieldQuestion } from 'lucide';
import type { Schema } from 'data-access';
import type { IconNode } from 'ui';

export type ApplicationType = NonNullable<Schema<'ApplicationInput'>['application_type']>;

export interface ApplicationCategory {
  readonly type: ApplicationType;
  readonly title: string;
  readonly body: string;
  readonly icon: IconNode;
}

/**
 * The five doors of S10 (ux-screen-map.md §3).
 *
 * The wording here is the product's character, not copy. Two rules govern it
 * and neither is negotiable in a later edit:
 *
 * **A category describes an EVENT, never an identity.** MASTER-SPEC §5.2
 * requires neutral wording, and the difference is exact: "I failed" is a
 * sentence about a person; "NSFAS paused my funding after a difficult year" is
 * a sentence about a circumstance. A student reading these cards is choosing
 * which sentence describes them, and one of those is a sentence nobody should
 * have to click.
 *
 * **OTHER is a door, not a fallback.** §5.6 makes Category D a first-class
 * fifth card of equal size — the component renders it in the same grid, at the
 * same weight, deliberately. A smaller card, or a "can't find yours?" link
 * underneath, turns an invitation into an afterthought, and the students most
 * likely to need it are the ones least likely to push on a footnote.
 */
export const APPLICATION_CATEGORIES: readonly ApplicationCategory[] = [
  {
    type: 'POSTGRAD',
    title: "I'm starting Honours, Master's or a PhD",
    body: 'Postgraduate study, where NSFAS does not reach. Includes a postgraduate diploma.',
    icon: GraduationCap as IconNode,
  },
  {
    type: 'UG_CAT_A',
    // Never "I failed". The event, not the person (§5.2).
    title: 'NSFAS paused my funding after a difficult year',
    body: 'Your results did not meet the requirement and your funding stopped. It happens, and it is not the end.',
    icon: BookOpen as IconNode,
  },
  {
    type: 'UG_CAT_B',
    title: 'NSFAS approved me, but my fees were not fully paid',
    body: 'The funding was granted and a gap was left — registration, accommodation, or a shortfall on the account.',
    icon: Receipt as IconNode,
  },
  {
    type: 'UG_CAT_C',
    title: 'I never qualified for NSFAS',
    body: 'You applied and were turned down, or you were told not to bother applying.',
    icon: ShieldQuestion as IconNode,
  },
  {
    type: 'OTHER',
    title: 'My situation is different — let me explain',
    body: 'None of these fit. Tell us in your own words, and a person will read every one of them.',
    icon: MessageSquareText as IconNode,
  },
];
