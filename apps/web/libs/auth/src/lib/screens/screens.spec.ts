import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgotPasswordComponent } from './forgot-password.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { ResetPasswordComponent } from './reset-password.component';
import { VerifyEmailComponent } from './verify-email.component';

function configure(component: unknown) {
  return TestBed.configureTestingModule({
    imports: [component as never],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();
}

const SCREENS = [
  { name: 'S04 register', component: RegisterComponent },
  { name: 'S05 login', component: LoginComponent },
  { name: 'S06 verify email', component: VerifyEmailComponent },
  { name: 'S07a forgot password', component: ForgotPasswordComponent },
  { name: 'S07b reset password', component: ResetPasswordComponent },
] as const;

describe.each(SCREENS)('$name (rendered)', ({ component }) => {
  it('has exactly one h1', async () => {
    await configure(component);
    const fixture = TestBed.createComponent(component as never);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).toHaveLength(1);
  });

  it('labels every visible control', async () => {
    // Two of these screens previously had a placeholder and no label at all.
    // A placeholder is not a label: it vanishes when someone types, and a
    // screen reader reaches an unnamed field.
    await configure(component);
    const fixture = TestBed.createComponent(component as never);
    fixture.detectChanges();
    const inputs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('input'),
    ) as HTMLInputElement[];
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('label'),
    ) as HTMLLabelElement[];
    for (const input of inputs) {
      const named =
        labels.some((l) => l.getAttribute('for') === input.id) ||
        Boolean(input.getAttribute('aria-label'));
      expect(named, `unlabelled input: ${input.outerHTML.slice(0, 80)}`).toBe(true);
    }
  });

  it('has no serious or critical accessibility violations', async () => {
    await configure(component);
    const fixture = TestBed.createComponent(component as never);
    fixture.detectChanges();
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S05 login', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LoginComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(async () => {
    await configure(LoginComponent);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  it('does not ask a student for an authenticator code up front', () => {
    // MFA is required of privileged accounts (ST-2.1), not of students.
    // Showing the field to everyone means every applicant meets a field for a
    // device they do not have, on the screen where they are least confident.
    expect(text()).not.toContain('Authenticator code');
  });

  it('asks for the code only once the server says one is needed', () => {
    fixture.componentInstance.form.setValue({
      email: 'student@uct.ac.za',
      password: 'a-long-enough-password',
      mfa_code: '',
    });
    fixture.componentInstance.submit();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/auth/login').flush(
      { error: { code: 'mfa_required', message: 'step up', request_id: 'r1' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(text()).toContain('Authenticator code');
    // And the message shown is the presentation table's, not the server's.
    expect(text()).toContain('One more step');
    expect(text()).not.toContain('step up');
  });

  it('renders the mapped wording for a bad password, never the server string', () => {
    fixture.componentInstance.form.setValue({
      email: 'student@uct.ac.za',
      password: 'wrong-password-here',
      mfa_code: '',
    });
    fixture.componentInstance.submit();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/auth/login').flush(
      {
        error: {
          code: 'invalid_credentials',
          message: 'INTERNAL: bcrypt compare failed for user 91af',
          request_id: 'r2',
        },
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(text()).toContain("That didn't match");
    // The server's prose can carry internal detail. It must never be rendered.
    expect(text()).not.toContain('bcrypt');
    expect(text()).not.toContain('91af');
  });
});

describe('the S4.12 rule, enforced across every auth screen', () => {
  // These screens read `err?.error?.error?.message` before this change and
  // printed it to the student. `message` is not a contract — it can be
  // reworded, translated, or made deliberately vaguer for security — so a
  // screen that branches on it breaks on a copy edit, and one that renders it
  // can leak server detail. The rule is machine-checked here rather than
  // trusted to review (doctrine L5).
  const dir = __dirname;
  const sources = readdirSync(dir).filter(
    (f) => f.endsWith('.component.ts') && !f.endsWith('.spec.ts'),
  );

  it('finds the screens', () => {
    expect(sources.length).toBe(5);
  });

  it.each(sources)('%s never reads error.message', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    expect(source).not.toMatch(/error\s*\?\.\s*message/);
    expect(source).not.toMatch(/\.error\s*\?\.\s*error\s*\?\.\s*message/);
    expect(source, 'renders a raw server message').not.toMatch(/err\s*\?\./);
  });

  it.each(sources)('%s uses no raw palette colour', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    // slate/blue/red/green utilities are the old placeholder brand and bypass
    // the token system entirely (S4.16) — including in dark mode, where they
    // simply do not adapt.
    expect(source).not.toMatch(/\b(?:text|bg|border)-(?:slate|blue|red|green|gray|zinc)-\d{3}\b/);
  });
});

describe('S07a forgot password', () => {
  it('gives the same answer whether or not the account exists', async () => {
    // Otherwise this form becomes a tool for discovering who has applied for
    // funding (S3.30).
    await configure(ForgotPasswordComponent);
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();

    fixture.componentInstance.form.setValue({ email: 'nobody@example.com' });
    fixture.componentInstance.submit();

    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/v1/auth/forgot-password')
      .flush({ error: { code: 'not_found', message: 'no user', request_id: 'r3' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Check your inbox');
  });
});

describe('S07b reset password', () => {
  it('treats a missing token as a state with a way out, not a red error', async () => {
    await configure(ResetPasswordComponent);
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('That link has expired');
    expect(text).toContain('Send me a new link');
  });
});
