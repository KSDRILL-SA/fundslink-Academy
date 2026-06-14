import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { initWebSentry } from './app/core/observability';
import { environment } from './environments/environment';

initWebSentry(environment.sentryDsn, environment.name);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
