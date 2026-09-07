import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BursariesComponent } from '../bursaries/bursaries.component';
import { NotificationsComponent } from '../notifications/notifications.component';
import { PrivacyComponent } from './privacy.component';
import { routes } from '../../app.routes';

function setup<T>(component: Type<T>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('S03 browse bursaries', () => {
  let fixture: ReturnType<typeof setup<BursariesComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(BursariesComponent));
  });

  function load(items: unknown[], next: string | null = null) {
    http
      .expectOne((r) => r.url === '/api/v1/bursaries')
      .flush({ items, meta: { next_cursor: next } });
    fixture.detectChanges();
  }

  it('says out loud that no account is needed', () => {
    // §1 — public. Someone deciding whether this platform is worth their time
    // must be able to see what is on offer first.
    expect(text()).toContain('you do not need an account to look');
  });

  it('is reachable publicly AND inside the app, from one component', () => {
    // Two routes, one implementation — the public list and the in-app list
    // cannot quietly differ.
    const publicPaths = (routes.find((r) => r.path === '')?.children ?? []).map((c) => c.path);
    const appPaths = (routes.find((r) => r.path === 'app')?.children ?? []).map((c) => c.path);
    expect(publicPaths).toContain('bursaries');
    expect(appPaths).toContain('bursaries');
  });

  it('warns before sending someone to a third-party site', () => {
    // A link that changes context should say so.
    load([
      {
        id: 'b1',
        name: 'Sasol Bursary',
        provider: 'Sasol',
        status: 'OPEN',
        source_url: 'https://example.org/apply',
      },
    ]);
    const link = el().querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toContain("opens on the funder's own site");
  });

  it('pages by cursor, appending rather than replacing', () => {
    load([{ id: 'b1', name: 'One', provider: 'P', status: 'OPEN' }], 'cursor-2');
    const more = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show more'),
    ) as HTMLButtonElement;
    more.click();

    const second = http.expectOne(
      (r) => r.url === '/api/v1/bursaries' && r.params.get('cursor') === 'cursor-2',
    );
    second.flush({ items: [{ id: 'b2', name: 'Two', provider: 'P', status: 'OPEN' }], meta: {} });
    fixture.detectChanges();

    expect(text()).toContain('One');
    expect(text()).toContain('Two');
  });

  it('has no serious or critical accessibility violations', async () => {
    load([{ id: 'b1', name: 'One', provider: 'P', status: 'OPEN' }]);
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S20 notifications', () => {
  let fixture: ReturnType<typeof setup<NotificationsComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(NotificationsComponent));
    http.expectOne((r) => r.url === '/api/v1/notifications/me').flush({ items: [], meta: {} });
    fixture.detectChanges();
  });

  it('states the consent rule rather than enforcing it silently (D-019)', () => {
    // A student who turns SMS on and finds it off again, unexplained,
    // experiences the platform as arbitrary.
    expect(text()).toContain('Text messages are optional');
    expect(text()).toContain('only go out if you have agreed to them');
  });

  it('does not offer a toggle for the channel it cannot switch off', () => {
    // Email is transactional — it is how someone learns their application
    // needs attention. Offering a switch that does nothing is worse than
    // explaining why there is no switch.
    expect(text()).toContain('not something we switch off');
    const checkboxes = Array.from(
      el().querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    for (const box of checkboxes) {
      expect(box.id).toContain('sms-');
    }
  });

  it('always sends the transactional channels when saving', () => {
    const save = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save preferences'),
    ) as HTMLButtonElement;
    save.click();

    const request = http.expectOne(
      (r) => r.url === '/api/v1/notifications/preferences' && r.method === 'PUT',
    );
    const body = request.request.body as { per_trigger: Record<string, string[]> };
    for (const channels of Object.values(body.per_trigger)) {
      expect(channels).toContain('EMAIL');
      expect(channels).toContain('IN_APP');
      expect(channels).not.toContain('SMS');
    }
  });

  it('adds SMS only where the student asked for it', () => {
    (el().querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();

    const save = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save preferences'),
    ) as HTMLButtonElement;
    save.click();

    const body = http.expectOne(
      (r) => r.url === '/api/v1/notifications/preferences',
    ).request.body as { per_trigger: Record<string, string[]> };
    const withSms = Object.values(body.per_trigger).filter((c) => c.includes('SMS'));
    expect(withSms).toHaveLength(1);
  });

  it('never shows a student an internal trigger key', () => {
    expect(text()).not.toContain('APPLICATION_SUBMITTED');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S21 data and privacy', () => {
  let fixture: ReturnType<typeof setup<PrivacyComponent>>['fixture'];
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture } = setup(PrivacyComponent));
  });

  it('says what is NOT in the export, rather than leaving it assumed', () => {
    // Both are promises made elsewhere in the system; this is where a student
    // can actually read them.
    expect(text()).toContain('Your ID number in full');
    expect(text()).toContain('not even we can read it back');
    expect(text()).toContain('Anything you discussed with a counsellor');
    expect(text()).toContain('never part of a funding decision');
  });

  it('names the Information Officer route, because POPIA requires a real one', () => {
    const mailto = el().querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
    expect(mailto).toBeTruthy();
    expect(text()).toContain('Information Officer');
  });

  it('does not offer a one-click account deletion', () => {
    // Permanent, and it ends any application in progress. A button someone
    // could press by accident is the wrong shape for that.
    expect(text()).toContain('by request rather than with a button');
    const deleteButton = Array.from(el().querySelectorAll('button')).find((b) =>
      /delete/i.test(b.textContent ?? ''),
    );
    expect(deleteButton).toBeUndefined();
  });

  it('warns the file contains personal information', () => {
    const download = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Download my data'),
    ) as HTMLButtonElement;
    download.click();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/v1/students/me/data-export')
      .flush({ profile: {}, applications: [] });
    fixture.detectChanges();

    expect(text()).toContain('Keep it somewhere safe');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
