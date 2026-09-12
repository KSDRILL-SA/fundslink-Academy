import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { previewInterceptors } from './preview-api';

/**
 * The gate on preview mode (doctrine L5: make the rule a gate, not a memory).
 *
 * Preview mode answers the API with fixtures so the product can be walked with
 * no backend running. On a platform that handles money and people's funding
 * applications, that is also the most dangerous thing that could ever reach
 * production: a student must never be shown invented facts about their own
 * application. So "it cannot ship" is asserted here, three ways, rather than
 * trusted to a code review noticing a flag.
 */
const root = join(__dirname, '..', '..', '..');
const shipped = readFileSync(join(__dirname, 'preview-api.ts'), 'utf8');
const angularJson = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8')) as {
  projects: Record<
    string,
    {
      architect: {
        build: {
          configurations: Record<string, { fileReplacements?: { replace: string; with: string }[] }>;
        };
      };
    }
  >;
};

describe('preview mode cannot reach production', () => {
  it('ships an empty interceptor chain', () => {
    // This is the module the production build compiles.
    expect(previewInterceptors).toEqual([]);
  });

  it('holds no fixture in the file that ships', () => {
    // A fixture here would be data a real student could be shown.
    expect(shipped).not.toMatch(/HttpResponse|fixture\s*=|const\s+PROFILE|access_token/);
  });

  it('is swapped in only by the development build configuration', () => {
    const configs = angularJson.projects['web'].architect.build.configurations;
    const dev = configs['development'].fileReplacements ?? [];
    expect(
      dev.some(
        (r) =>
          r.replace === 'src/app/dev/preview-api.ts' &&
          r.with === 'src/app/dev/preview-api.development.ts',
      ),
      'development must swap in the preview fixtures',
    ).toBe(true);

    for (const [name, config] of Object.entries(configs)) {
      if (name === 'development') {
        continue;
      }
      const replacements = config.fileReplacements ?? [];
      expect(
        replacements.some((r) => r.with.includes('preview-api.development')),
        `${name} must not swap in preview fixtures`,
      ).toBe(false);
    }
  });

  it('has the production environment asking for the real API', () => {
    // The default environment file is the production one; the development
    // build replaces it. Both halves of the switch are asserted so neither
    // can drift on its own.
    expect(environment.production).toBe(true);
    expect(environment.useMockApi).toBe(false);
  });
});
