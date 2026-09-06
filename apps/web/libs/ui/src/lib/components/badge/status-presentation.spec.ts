import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUS_PRESENTATION,
  STATUS_SOURCE_PRESENTATION,
  humanise,
  presentStatus,
} from './status-presentation';

/**
 * These are product rules, not styling preferences, and every one of them
 * fails *silently* — a wrong tone or a careless word renders perfectly and
 * only hurts the person reading it. So they are pinned here.
 */
describe('application status presentation', () => {
  const entries = Object.entries(APPLICATION_STATUS_PRESENTATION);

  it('covers the statuses the API can emit', () => {
    // Taken from the application state machine and the 0002 seeds.
    for (const status of [
      'DRAFT',
      'SUBMITTED',
      'PRE_SCREENING',
      'UNSCREENED',
      'READY_FOR_REVIEW',
      'UNDER_REVIEW',
      'RETURNED_FOR_INFO',
      'RESUBMITTED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEWED',
      'APPROVED_PROPOSED',
      'APPROVED',
      'APPROVED_WAITLISTED',
      'REJECTED',
      'REJECTED_FINAL',
      'APPEALED',
      'WITHDRAWN',
    ]) {
      expect(APPLICATION_STATUS_PRESENTATION[status], `${status} has no presentation`).toBeDefined();
    }
  });

  it('never relies on colour alone — every status has an icon and a label', () => {
    // WCAG 1.4.1. Colour alone is invisible to a colour-blind reader and to
    // anyone printing an application in black and white.
    for (const [status, presented] of entries) {
      expect(presented.label.trim(), `${status} has no label`).not.toBe('');
      expect(presented.icon, `${status} has no icon`).toBeDefined();
      expect(Array.isArray(presented.icon), `${status} icon is not icon data`).toBe(true);
    }
  });

  it('never says "rejected" to a student', () => {
    // "rejected" is a forbidden word on the decision screen (ux-screen-map,
    // S15/S16-REJ). A status chip is the one place it would slip back in.
    for (const [status, presented] of entries) {
      expect(presented.label.toLowerCase(), `${status} uses a forbidden word`).not.toContain(
        'reject',
      );
      expect(presented.label.toLowerCase(), `${status} uses a forbidden word`).not.toContain(
        'fail',
      );
      expect(presented.label.toLowerCase(), `${status} uses a forbidden word`).not.toContain(
        'denied',
      );
    }
  });

  it('never renders a declined outcome in the danger tone', () => {
    // A harsh red REJECTED badge turns a funding decision into a verdict on
    // the student. Neutral tone, honest words, door left open (§6, P4).
    for (const status of ['REJECTED', 'REJECTED_FINAL', 'WITHDRAWN']) {
      expect(APPLICATION_STATUS_PRESENTATION[status].tone, `${status} must not be danger`).not.toBe(
        'danger',
      );
    }
  });

  it('uses amber, not red, when more information is needed', () => {
    // A returned application is the platform asking for help, not a failure (P4).
    const returned = APPLICATION_STATUS_PRESENTATION['RETURNED_FOR_INFO'];
    expect(returned.tone).toBe('warning');
    expect(returned.label).toBe('Needs more information');
  });

  it('reserves the danger tone for nothing in the student lifecycle', () => {
    for (const [status, presented] of entries) {
      expect(presented.tone, `${status} must not be danger`).not.toBe('danger');
    }
  });
});

describe('status source presentation (P3 freshness)', () => {
  it('labels exactly the three sources the API enumerates', () => {
    expect(Object.keys(STATUS_SOURCE_PRESENTATION).sort()).toEqual([
      'EMAIL_CAPTURE',
      'PARTNER_API',
      'SELF_REPORT',
    ]);
    expect(STATUS_SOURCE_PRESENTATION['SELF_REPORT'].label).toBe('You reported');
    expect(STATUS_SOURCE_PRESENTATION['EMAIL_CAPTURE'].label).toBe('From email');
    expect(STATUS_SOURCE_PRESENTATION['PARTNER_API'].label).toBe('From partner');
  });
});

describe('presentStatus', () => {
  it('degrades an unknown status to something readable and neutral', () => {
    // The backend can add a status before this bundle is redeployed. A student
    // must never meet a crash or a blank chip because of it.
    const presented = presentStatus('SOME_NEW_BACKEND_STATUS');
    expect(presented.tone).toBe('neutral');
    expect(presented.label).toBe('Some new backend status');
    expect(presented.icon).toBeDefined();
  });

  it('handles null and undefined without throwing', () => {
    for (const value of [null, undefined, '']) {
      expect(() => presentStatus(value)).not.toThrow();
      expect(presentStatus(value).label).toBe('Unknown');
    }
  });

  it('reads from the source table when asked for a source', () => {
    expect(presentStatus('SELF_REPORT', STATUS_SOURCE_PRESENTATION).label).toBe('You reported');
  });
});

describe('humanise', () => {
  it('turns a screaming-snake status into a sentence', () => {
    expect(humanise('READY_FOR_REVIEW')).toBe('Ready for review');
    expect(humanise('DRAFT')).toBe('Draft');
  });
});
