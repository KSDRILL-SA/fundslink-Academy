import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROMISES } from './promises';

/**
 * A promise without backing fails the build.
 *
 * The audit that produced this file found claims that were true when written
 * and had quietly stopped being true — including one broken by a missing API
 * call rather than by wording. Nothing in CI could see it, because a sentence
 * in a template has no dependency on the code that keeps it.
 *
 * This gives it one. Each promise cites the file, migration or endpoint that
 * makes it true; if that evidence is deleted or renamed, this suite goes red
 * and someone has to decide — restore the mechanism, or stop making the claim.
 *
 * It cannot prove a mechanism *works*; that is what the API's own tests are
 * for. It proves the mechanism still exists, which is the failure mode that
 * actually happened.
 */
const REPO = join(__dirname, '..', '..', '..', '..', '..');

describe('every promise has something keeping it', () => {
  it('has a register with real entries', () => {
    expect(PROMISES.length).toBeGreaterThan(5);
  });

  it.each(PROMISES)('"$claim" — evidence exists', ({ evidence }) => {
    expect(existsSync(join(REPO, evidence)), `${evidence} is missing`).toBe(true);
  });

  it.each(PROMISES.filter((p) => p.marker))('"$claim" — $evidence still contains its marker', ({
    evidence,
    marker,
  }) => {
    const source = readFileSync(join(REPO, evidence), 'utf8');
    expect(source.includes(marker as string), `${evidence} no longer contains "${marker}"`).toBe(
      true,
    );
  });

  it('names where each promise is shown, so a change of mind can find every copy of it', () => {
    for (const promise of PROMISES) {
      expect(promise.shownOn.trim().length, `${promise.claim} does not say where it appears`)
        .toBeGreaterThan(3);
    }
  });
});

/**
 * The claims this product has already had to withdraw.
 *
 * Kept as a test rather than a comment: each of these was written in good
 * faith, shipped, and found to be untrue. The wording is banned so that it
 * cannot drift back in — if one of these mechanisms is ever actually built,
 * deleting the line here is the deliberate act of re-earning the claim.
 */
const WITHDRAWN: readonly { text: RegExp; because: string }[] = [
  {
    text: /nudge them|chase (the )?funder|chase quiet funders/i,
    because:
      'BR-T06 notifies the student at 30/45/60 days. Nothing in this system contacts a funder.',
  },
  {
    text: /money records are append-only|where the money goes/i,
    because: 'There is no money table in the schema. v1 records applications and decisions only.',
  },
  {
    text: /we will always email you/i,
    because: 'The email adapter logs rather than sends; nothing is delivered yet.',
  },
  {
    text: /(what|anything) you (tell|discussed with|share with) a counsellor/i,
    because: 'There is no counselling service — only a role in the permission model.',
  },
  {
    text: /in the order they arrive|oldest wait first|first come,? first served/i,
    because:
      'Applications are triaged — priority, then review due date, then need, then longest wait (D-002 / D-013). An emergency is not queued behind later arrivals.',
  },
  {
    text: /counted by when each application was waitlisted/i,
    because:
      'The waitlist is postgraduate first, then greatest need, then time (E4 / D-017, migration 0020) — not arrival order.',
  },
  {
    text: /tell you (the moment|when) your (position|place) changes|you do not need to check/i,
    because:
      'Nothing detects a change in waitlist position or notifies about one, and under need ordering a place can get worse when a higher-need student joins.',
  },
];

describe('withdrawn claims stay withdrawn', () => {
  const SCREENS = join(__dirname, '..');

  it.each(WITHDRAWN)('does not say "$because"', ({ text, because }) => {
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
      return readdirSync(dir).flatMap((entry: string) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          return walk(full);
        }
        return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
      });
    };

    for (const file of walk(SCREENS)) {
      const source = readFileSync(file, 'utf8');
      // Comments explain why a claim was withdrawn and must stay allowed; only
      // what a person can read on screen is checked.
      const visible = source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');
      expect(visible, `${file} still makes a withdrawn claim — ${because}`).not.toMatch(text);
    }
  });
});
