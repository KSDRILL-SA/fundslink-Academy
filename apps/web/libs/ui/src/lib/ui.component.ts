import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'lib-ui',
    imports: [],
    template: `
    <p>
      ui works!
    </p>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: ``
})
export class UiComponent {

}
