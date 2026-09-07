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

    it('sets a title and a description written for a person', () => {
      expect(TestBed.inject(Title).getTitle()).toContain('FundsLink Academy');
      const description = TestBed.inject(Meta).getTag('name="description"')?.content ?? '';
      expect(description).toContain('NSFAS');
      expect(description.length).toBeGreaterThan(60);
      expect(description.length).toBeLessThan(200);
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

    it('renders a finished hero with no photograph', () => {
      // §3.1 asks for a real, dignified photo of a South African student and
      // rejects stock. We have none, so the scrim must stand alone — and take
      // an image later without the layout changing.
      const scrim = el().querySelector('.fl-hero-scrim');
      expect(scrim).toBeTruthy();
      expect(scrim?.getAttribute('aria-hidden')).toBe('true');
      expect(el().querySelector('.fl-hero img')).toBeNull();
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
