import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountComponent } from './account.component';

/**
 * S — Account & security: two-step sign-in (ST-2.1, #305).
 *
 * The screen had no tests and kept "on" in a local flag, so a reload offered "Set up two-step
 * sign-in" to someone who already had it on, and nothing could say how many recovery codes were
 * left. These hold the screen to the server's answer.
 */

const STATUS = '/api/v1/auth/mfa';
const DISABLE = '/api/v1/auth/mfa/disable';
const RECOVERY = '/api/v1/auth/mfa/recovery-codes';

const ON = { enrolled: true, enabled: true, recovery_codes_remaining: 3, required_for_role: false };
const OFF = {
  enrolled: false,
  enabled: false,
  recovery_codes_remaining: 0,
  required_for_role: false,
};

describe('account — two-step sign-in', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(label));

  function start(status: object) {
    TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === STATUS && r.method === 'GET').flush(status);
    fixture.detectChanges();
  }

  function fillConfirm(password: string, code: string) {
    // The page has two forms (change password, and this one). Scope to the confirmation form, or
    // the password-change fields get filled and the request never goes out.
    const form = el().querySelector('form.max-w-md') as HTMLFormElement;
    const inputs = Array.from(form.querySelectorAll('input')) as HTMLInputElement[];
    const password_ = inputs.find((i) => i.getAttribute('type') === 'password')!;
    const code_ = inputs.find((i) => i.getAttribute('autocomplete') === 'one-time-code')!;
    for (const [field, value] of [
      [password_, password],
      [code_, code],
    ] as const) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
    }
    fixture.detectChanges();
  }

  it('asks the server what is on, instead of guessing', () => {
    start(OFF);
    expect(button('Set up two-step sign-in')).toBeTruthy();
    expect(text()).not.toContain('Two-step sign-in is on');
  });

  it('says it is on, and how many recovery codes are left', () => {
    start(ON);
    expect(text()).toContain('Two-step sign-in is on');
    expect(text()).toContain('3 recovery codes left');
    expect(button('Set up two-step sign-in')).toBeFalsy();
  });

  it('warns plainly when there are none left', () => {
    start({ ...ON, recovery_codes_remaining: 0 });
    expect(text()).toContain('no recovery codes left');
  });

  it('replaces the codes with both factors, and shows the new ones once', () => {
    start(ON);
    button('Replace recovery codes')?.click();
    fixture.detectChanges();
    fillConfirm('my-password', '123456');
    button('Replace codes')?.click();

    const request = http.expectOne((r) => r.url === RECOVERY && r.method === 'POST');
    expect(request.request.body).toEqual({ password: 'my-password', code: '123456' });
    request.flush({ recovery_codes: ['aaa-111', 'bbb-222'] });
    // The server is asked again: it decides what is now true, including the count.
    http.expectOne((r) => r.url === STATUS).flush({ ...ON, recovery_codes_remaining: 2 });
    fixture.detectChanges();

    expect(text()).toContain('aaa-111');
    expect(text()).toContain('Shown once');
    expect(text()).toContain('2 recovery codes left');
  });

  it('turns it off and comes back offering to set it up again', () => {
    start(ON);
    button('Turn off two-step sign-in')?.click();
    fixture.detectChanges();
    fillConfirm('my-password', 'recovery-code');
    button('Turn it off')?.click();

    const request = http.expectOne((r) => r.url === DISABLE && r.method === 'POST');
    expect(request.request.body).toEqual({ password: 'my-password', code: 'recovery-code' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne((r) => r.url === STATUS).flush(OFF);
    fixture.detectChanges();

    expect(button('Set up two-step sign-in')).toBeTruthy();
    expect(text()).not.toContain('Two-step sign-in is on');
  });

  it('never offers to turn it off where the role requires it, and says why', () => {
    start({ ...ON, required_for_role: true });
    expect(button('Turn off two-step sign-in')).toBeFalsy();
    expect(text()).toContain('two-step sign-in stays on');
    // Replacing codes is still the way out of a lost phone.
    expect(button('Replace recovery codes')).toBeTruthy();
  });

  it('sends nothing without both factors, and shows the server refusal in our words', () => {
    start(ON);
    button('Replace recovery codes')?.click();
    fixture.detectChanges();
    button('Replace codes')?.click();
    fixture.detectChanges();
    http.expectNone((r) => r.url === RECOVERY);

    fillConfirm('wrong', '000000');
    button('Replace codes')?.click();
    http
      .expectOne((r) => r.url === RECOVERY)
      .flush(
        { error: { code: 'invalid_credentials', message: 'Invalid email or password', request_id: 'r1' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();
    expect(text()).not.toContain('Invalid email or password');
    expect(el().querySelector('[role="alert"]')).toBeTruthy();
  });

  it('has no serious or critical accessibility violations', async () => {
    start(ON);
    button('Replace recovery codes')?.click();
    fixture.detectChanges();
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
