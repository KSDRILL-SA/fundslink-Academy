import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountActivityComponent } from './account-activity.component';
import { ActivityPageComponent } from './activity-page.component';

/** S08a — Account activity has a page of its own; the dashboard shows a preview (#294). */

const ACTIVITY = '/api/v1/students/me/activity';
const OVERVIEW = '/api/v1/students/me/overview';

const today = new Date();
const earlier = new Date(today.getFullYear() - 1, 2, 3, 9, 30);
const ITEMS = [
  { id: 'n1', occurred_at: today.toISOString(), category: 'SECURITY', event: 'AUTH_LOGIN_SUCCESS',
    actor: 'YOU', resource_id: null, to_status: null, label: null },
  { id: 'n2', occurred_at: earlier.toISOString(), category: 'ACCOUNT', event: 'PROFILE_UPDATED',
    actor: 'YOU', resource_id: null, to_status: null, label: null },
];

@Component({
  imports: [AccountActivityComponent],
  template: `<fl-account-activity [preview]="preview()" [category]="category()" />`,
})
class HostComponent {
  readonly preview = signal(false);
  readonly category = signal<string | null>(null);
}

describe('account activity timeline', () => {
  let fixture: ComponentFixture<HostComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HostComponent);
    http = TestBed.inject(HttpTestingController);
  });

  it('groups entries under a heading per day', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: ITEMS, meta: { next_cursor: null } });
    fixture.detectChanges();
    const headings = Array.from(el().querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings[0]).toBe('Today');
    expect(headings[1]).toContain(String(earlier.getFullYear()));
  });

  it('as a preview, asks for only the latest few and links to the full page instead of paging', () => {
    fixture.componentInstance.preview.set(true);
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === ACTIVITY);
    expect(request.request.params.get('limit')).toBe('5');
    request.flush({ items: ITEMS, meta: { next_cursor: 'more' } });
    fixture.detectChanges();
    const link = el().querySelector('a[href="/app/activity"]');
    expect(link?.textContent).toContain('See all account activity');
    expect(el().textContent).not.toContain('Show earlier activity');
  });

  it('asks the server for a category, and asks again when it changes', () => {
    fixture.componentInstance.category.set('SECURITY');
    fixture.detectChanges();
    const first = http.expectOne((r) => r.url === ACTIVITY);
    expect(first.request.params.get('category')).toBe('SECURITY');
    first.flush({ items: ITEMS.slice(0, 1), meta: { next_cursor: null } });

    fixture.componentInstance.category.set(null);
    fixture.detectChanges();
    const second = http.expectOne((r) => r.url === ACTIVITY);
    expect(second.request.params.has('category')).toBe(false);
    second.flush({ items: ITEMS, meta: { next_cursor: null } });
  });
});

describe('S08a account activity page', () => {
  let fixture: ComponentFixture<ActivityPageComponent>;
  let http: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ActivityPageComponent],
      providers: [
        provideRouter([{ path: 'app/activity', component: ActivityPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/app/activity?category=SECURITY');
    fixture = TestBed.createComponent(ActivityPageComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  function flushOverview() {
    http.expectOne((r) => r.url === OVERVIEW).flush({
      generated_at: '2026-09-13T08:00:00Z',
      applications: { total: 0, drafts: 0, needs_your_action: 0, with_fundslink: 0, decided: 0,
                      by_status: [] },
      tracking: { total: 0, active: 0, by_status: [], next_deadline: null },
      matches: { total: 0, last_run_at: null },
      notifications: { total: 0, last_at: null },
      account: { member_since: '2026-01-01T00:00:00Z',
                 previous_sign_in_at: '2026-09-11T06:15:00Z', mfa_enabled: true },
    });
  }

  it('opens on the filter named in the link, and the security summary sits above it', () => {
    flushOverview();
    const request = http.expectOne((r) => r.url === ACTIVITY);
    expect(request.request.params.get('category')).toBe('SECURITY');
    request.flush({ items: ITEMS.slice(0, 1), meta: { next_cursor: null } });
    fixture.detectChanges();

    const checked = el().querySelector<HTMLInputElement>('input[type=radio]:checked');
    expect(checked?.parentElement?.textContent).toContain('Sign-ins & security');
    expect(el().textContent).toContain('Previous sign-in:');
    expect(el().querySelector('h1')?.textContent).toContain('Account activity');
  });

  it('puts the chosen filter in the URL', async () => {
    flushOverview();
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: ITEMS, meta: {} });
    fixture.detectChanges();
    const applications = Array.from(el().querySelectorAll<HTMLInputElement>('input[type=radio]'))
      .find((input) => input.parentElement?.textContent?.includes('Applications'));
    applications?.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(router.url).toBe('/app/activity?category=APPLICATION');
  });

  it('has no serious or critical accessibility violations', async () => {
    flushOverview();
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: ITEMS, meta: {} });
    fixture.detectChanges();
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
