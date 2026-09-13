import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiLogoComponent, type LogoSize, type LogoVariant } from './ui-logo.component';

/**
 * The Rising Door (Founder direction, 2026-09-13).
 *
 * `apps/web/scripts/build-logo.mjs` owns the geometry and writes every logo file; the component
 * draws the same mark inline. These tests hold the two together, so a change to one cannot leave
 * the header, the favicon and the app icon showing different logos.
 */

@Component({
  imports: [UiLogoComponent],
  template: `<ui-logo [variant]="variant()" [size]="size()" [showWordmark]="wordmark()" />`,
})
class HostComponent {
  readonly variant = signal<LogoVariant>('color');
  readonly size = signal<LogoSize>('xl');
  readonly wordmark = signal(true);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require('node:path') as typeof import('node:path');

// __dirname is apps/web/libs/ui/src/lib/brand
const WEB = join(__dirname, '..', '..', '..', '..', '..');
const generator = readFileSync(join(WEB, 'scripts', 'build-logo.mjs'), 'utf8');

function geometry(name: string): string {
  const match = generator.match(new RegExp(String.raw`const ${name} =\s*'?([^';\n]+)'?;`));
  if (!match) {
    throw new Error(`build-logo.mjs no longer defines ${name}`);
  }
  return match[1];
}

function render(variant: LogoVariant, wordmark = true, size: LogoSize = 'xl'): HTMLElement {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.variant.set(variant);
  fixture.componentInstance.size.set(size);
  fixture.componentInstance.wordmark.set(wordmark);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ui-logo — the Rising Door', () => {
  const full = ['DOOR', 'STEPS', 'CAP_BOARD', 'CAP_CROWN', 'CAP_TASSEL'];

  for (const variant of ['color', 'mono', 'plate'] as const) {
    for (const size of ['sm', 'xl'] as const) {
      it(`draws the generator's geometry — ${variant}, ${size}`, () => {
        const drawn = Array.from(render(variant, true, size).querySelectorAll('path')).map((p) =>
          p.getAttribute('d'),
        );
        for (const shape of full) {
          expect(drawn, `${shape} is missing or differs from build-logo.mjs`).toContain(
            geometry(shape),
          );
        }
      });
    }
  }

  it('uses the real Lucide graduation-cap glyph, not a look-alike', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lucide = require('lucide') as Record<string, [string, { d?: string }][]>;
    const glyph = lucide['GraduationCap'].map(([, attrs]) => attrs.d);
    expect(glyph).toEqual([geometry('CAP_BOARD'), geometry('CAP_TASSEL'), geometry('CAP_CROWN')]);
  });

  it('draws the path in silver and the achievement in gold', () => {
    const el = render('color', true, 'xl');
    const fill = (d: string) => el.querySelector(`path[d="${geometry(d)}"]`)?.getAttribute('fill') ?? '';
    expect(fill('STEPS')).toContain('fl-logo-silver');
    expect(fill('CAP_BOARD')).toContain('fl-logo-gold');
    const stops = Array.from(el.querySelectorAll('linearGradient[id^="fl-logo-silver"] stop')).map(
      (s) => s.getAttribute('stop-color'),
    );
    expect(stops).toEqual(['#f1f5f9', '#cbd5e1', '#94a3b8']);
  });

  it('draws three steps, and lit treads only where they can render', () => {
    expect(geometry('STEPS').match(/h/g)).toHaveLength(3);
    const treads = (el: HTMLElement) => el.querySelector(`path[d="${geometry('TREADS')}"]`);
    expect(treads(render('color', true, 'xl'))).toBeTruthy();
    TestBed.resetTestingModule();
    expect(treads(render('color', true, 'sm'))).toBeNull();
  });

  it('weights the doorway heavier where the mark is small, and enlarges the header plate', () => {
    const door = (el: HTMLElement) =>
      el.querySelector(`path[d="${geometry('DOOR')}"]`)?.getAttribute('stroke-width');
    const small = render('plate', true, 'sm');
    expect(door(small)).toBe(geometry('DOOR_WEIGHT_SMALL'));
    // The header plate is 40 px, not the 34 px that made the mark a smudge (2026-09-13).
    expect((small.querySelector('.fl-logo-plate') as HTMLElement).style.width).toBe('40px');
    TestBed.resetTestingModule();
    expect(door(render('plate', true, 'xl'))).toBe(geometry('DOOR_WEIGHT'));
  });

  it('puts light through the doorway only on a large plate', () => {
    const light = (el: HTMLElement) => el.querySelector(`path[d="${geometry('LIGHT')}"]`);
    expect(light(render('plate'))).toBeTruthy();
    TestBed.resetTestingModule();
    expect(light(render('color'))).toBeNull();
  });

  it('never leaves a gradient id to collide with another logo on the page', () => {
    TestBed.configureTestingModule({ imports: [UiLogoComponent] });
    const a = TestBed.createComponent(UiLogoComponent);
    const b = TestBed.createComponent(UiLogoComponent);
    for (const f of [a, b]) {
      f.componentRef.setInput('variant', 'plate');
      f.detectChanges();
    }
    const id = (f: typeof a) =>
      (f.nativeElement as HTMLElement).querySelector('linearGradient')?.getAttribute('id');
    expect(id(a)).toBeTruthy();
    expect(id(a)).not.toBe(id(b));
  });

  it('always carries the name for assistive technology, and hides the artwork', () => {
    const el = render('mono', false);
    expect(el.querySelector('.sr-only')?.textContent).toContain('FundsLink Academy');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('ships every icon file the page asks for, generated from the same mark', () => {
    const html = readFileSync(join(WEB, 'src', 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(hrefs).toEqual(['logo-mark-small.svg', 'favicon.ico', 'apple-touch-icon.png']);
    for (const href of hrefs) {
      expect(existsSync(join(WEB, 'public', href)), `${href} is missing from public/`).toBe(true);
    }
    for (const file of ['logo-mark.svg', 'logo-mark-small.svg', 'logo-app-icon.svg']) {
      expect(readFileSync(join(WEB, 'public', file), 'utf8'), file).toContain(geometry('CAP_BOARD'));
    }
  });
});
