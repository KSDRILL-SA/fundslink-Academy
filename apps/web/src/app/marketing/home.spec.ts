import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MarketingHomeComponent } from './home.component';

describe('marketing home (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<MarketingHomeComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(MarketingHomeComponent);
    fixture.detectChanges();
  });

  describe('document structure (§7)', () => {
    it('has exactly one h1', () => {
      // More than one h1 makes the page outline meaningless to a screen-reader
      // user navigating by heading, and muddies what the page is about.
      expect(el().querySelectorAll('h1')).toHaveLength(1);
      expect(el().querySelector('h1')?.textContent).toContain('Past the cracks');
    });

    it('does not skip a heading level', () => {
      const levels = Array.from(el().querySelectorAll('h1, h2, h3')).map((h) =>
        Number(h.tagName.slice(1)),
      );
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(levels[i] - levels[i - 1], `jump at heading ${i}`).toBeLessThanOrEqual(1);
      }
    });

    // The description used to have to name NSFAS. It must not: describing this
    // platform by another funder's "gap" reads as a comparison, and a student
    // or a partner can fairly take it as competition with the national scheme.
    // What is true says more — we fund what other funding does not reach.
    it('sets a title and a description written for a person', () => {
      expect(TestBed.inject(Title).getTitle()).toContain('FundsLink Academy');
      const description = TestBed.inject(Meta).getTag('name="description"')?.content ?? '';
      expect(description).toContain('South African');
      expect(description).toContain('bursary funding');
      expect(description.length).toBeGreaterThan(60);
      expect(description.length).toBeLessThan(220);
    });

    it('carries Open Graph tags for a shared link', () => {
      const meta = TestBed.inject(Meta);
      expect(meta.getTag('property="og:title"')).toBeTruthy();
      expect(meta.getTag('property="og:description"')).toBeTruthy();
    });
  });

  describe('the hero (§3.1)', () => {
    it('offers the three gateway paths as a named navigation', () => {
      const gateway = el().querySelector('nav[aria-labelledby="gateway-label"]');
      expect(gateway).toBeTruthy();
      expect(gateway?.querySelectorAll('a')).toHaveLength(3);
      expect(gateway?.textContent).toContain('Student — apply');
      expect(gateway?.textContent).toContain('Donor — give');
      expect(gateway?.textContent).toContain('Partner with us');
    });

    it('gives the primary action to students, in gold', () => {
      // One primary action per view (§1); on a platform for students it is
      // theirs, and the accent is the brand's hope colour.
      const primary = el().querySelector('nav[aria-labelledby="gateway-label"] a ui-button button');
      expect(primary?.className).toContain('bg-accent');
    });

    it('keeps a quiet path for someone not ready to apply', () => {
      expect(text()).toContain('Just browsing?');
    });

    it('puts nothing over the photograph — the application card has its own section', () => {
      // Founder, 2026-09-13: the floating card hid the students on the steps.
      const hero = el().querySelector('.fl-hero');
      expect(hero?.querySelector('.fl-status-card')).toBeNull();
      expect(hero?.textContent).not.toContain('Your funding application');

      const card = el().querySelector('.fl-status-card');
      expect(card).toBeTruthy();
      expect(card?.closest('.fl-hero')).toBeNull();
    });

    it('says in words everything the decorative card shows', () => {
      // The card is aria-hidden, so its claims must be readable beside it.
      expect(el().querySelector('.fl-status-card')?.closest('[aria-hidden="true"]')).toBeTruthy();
      expect(text()).toContain('Always know where you stand');
      expect(text()).toContain('A person makes the decision');
      expect(text()).toContain('Bursaries you actually fit');
      expect(text()).toContain('Every sign-in and change is listed');
    });

    describe('the hero image', () => {
      const img = () => el().querySelector<HTMLImageElement>('.fl-hero img');
      const sources = () =>
        Array.from(el().querySelectorAll<HTMLSourceElement>('.fl-hero picture source'));

      it('keeps the scrim over it, so the text holds AA contrast', () => {
        const scrim = el().querySelector('.fl-hero-scrim');
        expect(scrim).toBeTruthy();
        expect(scrim?.getAttribute('aria-hidden')).toBe('true');
      });

      it('describes the scene and never claims the people are our students', () => {
        // Founder-supplied, art-directed image of the setting (L4, 2026-09-13).
        // Presenting it as a FundsLink beneficiary would be fabricating a person.
        const alt = img()?.getAttribute('alt') ?? '';
        expect(alt.length).toBeGreaterThan(20);
        expect(alt).not.toMatch(/fundslink|our students?|beneficiar|funded|recipient/i);
      });

      it('reserves its box so the page does not shift when it arrives', () => {
        expect(img()?.getAttribute('width')).toBe('1536');
        expect(img()?.getAttribute('height')).toBe('1024');
      });

      it('is fetched early, as the LCP candidate', () => {
        expect(img()?.getAttribute('fetchpriority')).toBe('high');
        expect(img()?.getAttribute('loading')).toBe('eager');
      });

      it('offers the phone crop first, and AVIF before WebP within each crop', () => {
        // A browser takes the FIRST <source> it can use, so order is behaviour.
        const described = sources().map((s) => `${s.media ? 'mobile' : 'desktop'}:${s.type}`);
        expect(described).toEqual([
          'mobile:image/avif',
          'mobile:image/webp',
          'desktop:image/avif',
          'desktop:image/webp',
        ]);
      });

      it('is preloaded with exactly the srcsets the <picture> uses, or it would download twice', () => {
        const { readFileSync } = require('node:fs') as typeof import('node:fs');
        const { join } = require('node:path') as typeof import('node:path');
        const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
        const avif = sources().filter((s) => s.type === 'image/avif');

        for (const source of avif) {
          const media = source.getAttribute('media') ?? '(min-width: 768px)';
          const srcset = source.getAttribute('srcset') ?? '';
          expect(html, `index.html preload is missing ${media} / ${srcset}`).toContain(
            `['${media}', '${srcset}']`,
          );
        }
        // Scoped to the home route, so /app never pays for marketing imagery (P6).
        expect(html).toContain("location.pathname !== '/'");
      });

      it('references only files that exist, so it can never fail as a silent blank', () => {
        const { existsSync } = require('node:fs') as typeof import('node:fs');
        const { join } = require('node:path') as typeof import('node:path');
        const publicDir = join(__dirname, '..', '..', '..', 'public');
        const urls = [
          img()?.getAttribute('src') ?? '',
          ...sources().flatMap((s) =>
            (s.getAttribute('srcset') ?? '').split(',').map((c) => c.trim().split(/\s+/)[0]),
          ),
        ].filter(Boolean);

        expect(urls.length).toBe(9);
        for (const url of urls) {
          expect(existsSync(join(publicDir, url)), `${url} is missing from public/`).toBe(true);
        }
      });
    });
  });

  describe('the static meta description', () => {
    it('equals the approved positioning line, for crawlers and link previews', () => {
      // Static, because a WhatsApp preview or a search crawler reads index.html without running
      // the app. It carried the withdrawn "fall through the NSFAS gap" wording long after the page
      // itself had changed — nothing compared the two.
      const { readFileSync } = require('node:fs') as typeof import('node:fs');
      const { join } = require('node:path') as typeof import('node:path');
      const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
      const { ORGANISATION } = require('../content/organisation') as typeof import('../content/organisation');

      expect(html).toContain(`<meta name="description" content="${ORGANISATION.positioning}">`);
      expect(html).not.toMatch(/NSFAS gap|fall(s)? through the/i);
    });
  });

  describe('the promises it makes', () => {
    it('states the Human-Final principle as a feature, not fine print', () => {
      expect(text()).toContain('A person reviews every application');
      expect(text()).toContain('It never decides your funding');
    });

    it('says a decline still opens doors', () => {
      // P2/P4 — the kind-rejection promise made in public, before anyone applies.
      expect(text()).toContain('including the ones we cannot fund');
      expect(text()).toContain('next doors to try');
    });

    it('never uses the word "rejected" about a student', () => {
      expect(text().toLowerCase()).not.toContain('reject');
    });

    it('claims no registration number it cannot stand behind', () => {
      // NPC / PBO / §18A are marked "once live" in the design (§8). Inventing
      // one on a non-profit funding page would be a fabricated credential.
      expect(text()).not.toMatch(/\bNPC\b|\bPBO\b|18A/);
    });

    it('carries no testimonial, because no consented story exists yet', () => {
      // §3.5 needs real, consented student voices. Inventing them would be
      // fabricating people on a platform that funds real ones.
      expect(el().querySelector('blockquote')).toBeNull();
    });

    it('makes no unverifiable numeric claim', () => {
      // "No vanity metrics" (§3.2). Nothing here should assert a count of
      // students funded or rands disbursed until those numbers are real.
      expect(text()).not.toMatch(/R\s?\d[\d ,.]*\s*(million|m\b)/i);
      expect(text()).not.toMatch(/\d[\d ,]*\+?\s+students funded/i);
    });
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
