import { provideHttpClient } from '@angular/common/http';
import type { Type } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProfileComponent } from './profile/profile.component';

function setup<T>(component: Type<T>) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

const PROFILE = {
  id: 'p1',
  first_name: 'Thandi',
  last_name: 'Mokoena',
  level: 'HONOURS',
  field_of_study: 'BCom Accounting',
  verification_level: 'BRONZE',
  created_at: '2026-01-01T00:00:00Z',
};

type Body = Record<string, unknown> | null;

function flushBoth(http: HttpTestingController, applications: Body, profile: Body, status = 200) {
  const appsReq = http.expectOne((r) => r.url === '/api/v1/applications');
  const profileReq = http.expectOne((r) => r.url === '/api/v1/students/me/profile');
  if (status === 200) {
    appsReq.flush(applications);
    profileReq.flush(profile);
  } else {
    appsReq.flush(applications, { status, statusText: 'Error' });
    profileReq.flush(profile, { status, statusText: 'Error' });
  }
}

describe('S08 dashboard', () => {
  let fixture: ReturnType<typeof setup<DashboardComponent>>['fixture'];
  let http: HttpTestingController;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(DashboardComponent));
  });

  it('shows a skeleton while loading, never a bare spinner', () => {
    // §4: skeletons reserve the space the content will occupy, so nothing
    // jumps when it lands.
    expect((fixture.nativeElement as HTMLElement).querySelector('ui-skeleton')).toBeTruthy();
    expect(text()).not.toContain('undefined');
    http.expectOne((r) => r.url === '/api/v1/applications');
    http.expectOne((r) => r.url === '/api/v1/students/me/profile');
  });

  it('greets without a name before the profile exists', () => {
    // The normal first visit. "Welcome, undefined" is the classic version of
    // this bug and it greets the person at their least confident moment.
    expect(text()).toContain('Welcome');
    expect(text()).not.toContain('undefined');
  });

  describe('with nothing yet', () => {
    beforeEach(() => {
      flushBoth(http, { items: [], meta: { next_cursor: null } }, null);
      fixture.detectChanges();
    });

    it('teaches the next screen instead of showing a blank page (P2)', () => {
      expect(text()).toContain('You have not applied yet');
      expect(text()).toContain('Start my application');
    });

    it('says applying is free, because that is the first real question', () => {
      expect(text()).toContain('free');
    });

    it('offers exactly one action per empty state', () => {
      const buttons = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('ui-empty-state button'),
      );
      // One for the application, one for the profile — one each, not a menu.
      expect(buttons).toHaveLength(2);
    });
  });

  describe('with an application in pre-screening', () => {
    beforeEach(() => {
      flushBoth(
        http,
        { items: [{ id: 'a1', status: 'PRE_SCREENING', created_at: '2026-02-01T00:00:00Z' }], meta: {} },
        PROFILE,
      );
      fixture.detectChanges();
    });

    it('states the Human-Final principle where it matters most (P5)', () => {
      // The moment a student is most likely to think a machine is judging them.
      expect(text()).toContain('cannot approve or decline you');
      expect(text()).toContain('only a person can do that');
    });

    it('renders the status through the shared chip, not ad-hoc text', () => {
      expect((fixture.nativeElement as HTMLElement).querySelector('ui-status-chip')).toBeTruthy();
      expect(text()).toContain('Checking your details');
    });

    it('greets the student by name once it knows it', () => {
      expect(text()).toContain('Welcome back, Thandi');
    });
  });

  describe('when the API fails', () => {
    beforeEach(() => {
      flushBoth(
        http,
        { error: { code: 'rate_limited', message: 'slow down', request_id: 'req-77' } },
        { error: { code: 'rate_limited', message: 'slow down', request_id: 'req-77' } },
        429,
      );
      fixture.detectChanges();
    });

    it('shows the mapped wording, never the server string', () => {
      expect(text()).toContain('Too many attempts');
      expect(text()).not.toContain('slow down');
    });

    it('surfaces the request id a student would quote to support', () => {
      expect(text()).toContain('req-77');
    });

    it('offers a retry for a retryable failure', () => {
      const retry = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((b) => b.textContent?.includes('Try again'));
      expect(retry).toBeTruthy();
    });
  });

  it('has no serious or critical accessibility violations', async () => {
    flushBoth(http, { items: [], meta: {} }, null);
    fixture.detectChanges();
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S09 profile', () => {
  let fixture: ReturnType<typeof setup<ProfileComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(ProfileComponent));
  });

  function loadProfile(profile: Body) {
    http.expectOne((r) => r.url === '/api/v1/students/me/profile').flush(profile);
    fixture.detectChanges();
  }

  it('explains why an ID number is being asked for, and what happens to it', () => {
    // Being asked for an ID number by a website is exactly when a person
    // should be suspicious. Asking silently is how you lose someone here.
    loadProfile(null);
    expect(text()).toContain('Funders require this');
    expect(text()).toContain('We encrypt it');
    expect(text()).toContain('never show it back in full');
  });

  it('keeps the hardship narrative optional', () => {
    // Nobody should have to describe the hardest thing in their life to
    // create a profile.
    loadProfile(null);
    const narrative = el().querySelector('textarea') as HTMLTextAreaElement;
    expect(narrative.required).toBe(false);
    expect(text()).toContain('Optional, and in your own words');
  });

  it('invites any South African language (P7)', () => {
    loadProfile(null);
    expect(text()).toContain('write in the language you think in');
  });

  it('fills the form from an existing profile rather than asking again', () => {
    loadProfile(PROFILE);
    const first = el().querySelector('input') as HTMLInputElement;
    expect(fixture.componentInstance.form.getRawValue().first_name).toBe('Thandi');
    expect(first).toBeTruthy();
  });

  it('never pre-fills the ID number, because the API never returns it', () => {
    // Raw SA ID is never echoed back (TAD §4.4). A blank field on an edit
    // means "unchanged", not "deleted".
    loadProfile({ ...PROFILE, id_number: 'SHOULD-NEVER-APPEAR' });
    expect(fixture.componentInstance.form.getRawValue().id_number).toBe('');
    expect(text()).not.toContain('SHOULD-NEVER-APPEAR');
  });

  it('omits empty optional fields instead of sending blanks', () => {
    loadProfile(null);
    fixture.componentInstance.form.patchValue({
      first_name: 'Thandi',
      last_name: 'Mokoena',
      level: 'HONOURS',
      field_of_study: 'BCom Accounting',
    });
    fixture.componentInstance.submit();

    const request = http.expectOne(
      (r) => r.url === '/api/v1/students/me/profile' && r.method === 'PUT',
    );
    expect(request.request.body).toEqual({
      first_name: 'Thandi',
      last_name: 'Mokoena',
      level: 'HONOURS',
      field_of_study: 'BCom Accounting',
    });
    expect(Object.keys(request.request.body)).not.toContain('phone');
  });

  it('has no serious or critical accessibility violations', async () => {
    loadProfile(null);
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
