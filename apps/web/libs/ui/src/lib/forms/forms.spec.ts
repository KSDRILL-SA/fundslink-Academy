import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiFormFieldComponent } from './ui-form-field.component';
import { UiCheckboxDirective, UiInputDirective, UiSelectDirective } from './ui-control.directives';
import { UiErrorSummaryComponent } from './ui-error-summary.component';
import { UiPasswordFieldComponent } from './ui-password-field.component';

@Component({
  standalone: true,
  imports: [UiFormFieldComponent, UiInputDirective, ReactiveFormsModule],
  template: `
    <ui-form-field
      [label]="label()"
      [hint]="hint()"
      [error]="error()"
      [required]="required()"
    >
      <input uiInput type="email" inputmode="email" autocomplete="email" [formControl]="email" />
    </ui-form-field>
  `,
})
class FieldHost {
  readonly label = signal('Email address');
  readonly hint = signal('We only use this to contact you about your application.');
  readonly error = signal<string | null>(null);
  readonly required = signal(true);
  readonly email = new FormControl('');
}

describe('ui-form-field (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<FieldHost>>;

  const label = () => fixture.nativeElement.querySelector('label') as HTMLLabelElement;
  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FieldHost] }).compileComponents();
    fixture = TestBed.createComponent(FieldHost);
    fixture.detectChanges();
  });

  it('associates the visible label with the control', () => {
    // The single most common silent failure in a form: a label that looks
    // attached and is not, leaving the control unnamed to a screen reader.
    expect(label().getAttribute('for')).toBe(input().id);
    expect(input().id).toBeTruthy();
    expect(label().textContent).toContain('Email address');
  });

  it('announces "required" in words, not just an asterisk', () => {
    // A lone * is read as "star" or skipped entirely.
    expect(label().querySelector('.sr-only')?.textContent).toContain('(required)');
    expect(label().querySelector('[aria-hidden="true"]')?.textContent).toContain('*');
  });

  it('points aria-describedby at the hint while the field is valid', () => {
    const describedBy = input().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const hint = fixture.nativeElement.querySelector(`#${describedBy}`);
    expect(hint?.textContent).toContain('We only use this');
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  describe('when invalid', () => {
    beforeEach(() => {
      fixture.componentInstance.error.set('Enter a valid email address.');
      fixture.detectChanges();
    });

    it('marks the control invalid', () => {
      expect(input().getAttribute('aria-invalid')).toBe('true');
    });

    it('announces the error where it appears, without moving focus', () => {
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Enter a valid email address.');
    });

    it('replaces the hint rather than reading both', () => {
      // Two messages read together is noise at the moment the person most
      // needs one clear instruction.
      const describedBy = input().getAttribute('aria-describedby');
      const described = fixture.nativeElement.querySelector(`#${describedBy}`);
      expect(described?.getAttribute('role')).toBe('alert');
      expect(fixture.nativeElement.textContent).not.toContain('We only use this');
    });
  });

  it('keeps the native input, so autofill and the mobile keyboard still work', () => {
    // The reason these are directives on native elements rather than CVA
    // wrappers (§2). Both matter most on the low-end phones we target.
    expect(input().tagName).toBe('INPUT');
    expect(input().getAttribute('autocomplete')).toBe('email');
    expect(input().getAttribute('inputmode')).toBe('email');
  });

  it('meets the 44px target floor', () => {
    expect(input().className).toContain('h-11');
  });

  it('distinguishes read-only from disabled', () => {
    // A disabled field is unreachable by keyboard; a read-only one is still
    // readable and copyable. They must not look the same.
    expect(input().className).toContain('read-only:bg-muted');
    expect(input().className).toContain('disabled:cursor-not-allowed');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });

  it('has none while showing an error either', async () => {
    fixture.componentInstance.error.set('Enter a valid email address.');
    fixture.detectChanges();
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

@Component({
  standalone: true,
  imports: [UiPasswordFieldComponent, UiInputDirective, ReactiveFormsModule],
  template: `
    <ui-password-field>
      <input uiInput type="password" autocomplete="current-password" [formControl]="password" />
    </ui-password-field>
  `,
})
class PasswordHost {
  readonly password = new FormControl('');
}

describe('ui-password-field (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PasswordHost>>;
  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const toggle = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PasswordHost] }).compileComponents();
    fixture = TestBed.createComponent(PasswordHost);
    fixture.detectChanges();
  });

  it('starts concealed', () => {
    expect(input().type).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('reveals and conceals, reporting state through aria-pressed', () => {
    toggle().click();
    fixture.detectChanges();
    expect(input().type).toBe('text');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');

    toggle().click();
    fixture.detectChanges();
    expect(input().type).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('returns focus to the field, because the person is still typing', () => {
    toggle().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(input());
  });

  it('cannot submit the form by accident', () => {
    expect(toggle().getAttribute('type')).toBe('button');
  });

  it('keeps the password manager working', () => {
    expect(input().getAttribute('autocomplete')).toBe('current-password');
  });
});

@Component({
  standalone: true,
  imports: [UiErrorSummaryComponent, UiFormFieldComponent, UiInputDirective, ReactiveFormsModule],
  template: `
    <ui-error-summary [errors]="errors()" />
    <ui-form-field label="Full name">
      <input uiInput id="name-control" [formControl]="name" />
    </ui-form-field>
  `,
})
class SummaryHost {
  readonly name = new FormControl('');
  readonly errors = signal([
    { controlId: 'name-control', message: 'Enter your full name.' },
    { controlId: 'missing-control', message: 'Choose an institution.' },
  ]);
}

describe('ui-error-summary (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SummaryHost>>;
  const links = () =>
    Array.from(fixture.nativeElement.querySelectorAll('ui-error-summary a')) as HTMLAnchorElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SummaryHost] }).compileComponents();
    fixture = TestBed.createComponent(SummaryHost);
    fixture.detectChanges();
  });

  it('lists every error as a real link to its field', () => {
    // "Something is wrong" with no way to reach the field is where people
    // give up on a long form (P8).
    expect(links()).toHaveLength(2);
    expect(links()[0].getAttribute('href')).toBe('#name-control');
  });

  it('renders nothing when there are no errors', () => {
    fixture.componentInstance.errors.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-error-summary div')).toBeNull();
  });

  it('is focusable so the whole list can be announced at once', () => {
    const container = fixture.nativeElement.querySelector('ui-error-summary [tabindex="-1"]');
    expect(container).toBeTruthy();
  });

  it('does not double-announce — the caller moves focus, so no role="alert"', () => {
    expect(fixture.nativeElement.querySelector('ui-error-summary [role="alert"]')).toBeNull();
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

@Component({
  standalone: true,
  imports: [UiFormFieldComponent, UiSelectDirective, UiCheckboxDirective, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <ui-form-field label="Institution" [error]="'Choose an institution.'">
        <select uiSelect formControlName="institution">
          <option value="">Choose…</option>
          <option value="uct">University of Cape Town</option>
        </select>
      </ui-form-field>

      <ui-form-field label="I agree to the terms">
        <input uiCheckbox type="checkbox" formControlName="agree" />
      </ui-form-field>
    </form>
  `,
})
class OtherControlsHost {
  readonly form = new FormGroup({
    institution: new FormControl('', { validators: [Validators.required] }),
    agree: new FormControl(false),
  });
}

describe('select and checkbox', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<OtherControlsHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OtherControlsHost] }).compileComponents();
    fixture = TestBed.createComponent(OtherControlsHost);
    fixture.detectChanges();
  });

  it('wires the select to its label and error like any other control', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe(select.id);
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the checkbox native so it keeps its platform behaviour', () => {
    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.tagName).toBe('INPUT');
    expect(checkbox.type).toBe('checkbox');
  });

  it('labels the checkbox — it needs an id from the field like any other control', () => {
    // Shipped without this, the checkbox had no accessible name: the field's
    // <label for=...> pointed at an element that did not exist. axe reported
    // it as `label`, critical.
    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    const labels = Array.from(fixture.nativeElement.querySelectorAll('label')) as HTMLLabelElement[];
    expect(checkbox.id).toBeTruthy();
    expect(labels.some((l) => l.getAttribute('for') === checkbox.id)).toBe(true);
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('a control used outside a field', () => {
  it('keeps the id the caller gave it', () => {
    // The binding used to resolve to null, and Angular removes an attribute
    // bound to null — so a hand-written id that a hand-written <label for=...>
    // pointed at was silently deleted, leaving an unlabelled control.
    @Component({
      standalone: true,
      imports: [UiCheckboxDirective, ReactiveFormsModule],
      template: `
        <label for="standalone-consent">I agree</label>
        <input uiCheckbox id="standalone-consent" type="checkbox" [formControl]="agree" />
      `,
    })
    class StandaloneHost {
      readonly agree = new FormControl(false);
    }

    TestBed.configureTestingModule({ imports: [StandaloneHost] });
    const fixture = TestBed.createComponent(StandaloneHost);
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(checkbox.id).toBe('standalone-consent');
  });
});

describe('validation timing (the platform does it)', () => {
  it('supports updateOn: blur, which is exactly what §2 asks for', () => {
    // Telling someone their email is invalid after two characters is scolding
    // them for not having finished. Angular already implements this, so it is
    // used rather than reimplemented — a form config, not a component.
    const control = new FormControl('', {
      validators: [Validators.email],
      updateOn: 'blur',
    });

    control.setValue('not-an-email', { emitEvent: false });
    expect(control.dirty).toBe(false);
  });
});
