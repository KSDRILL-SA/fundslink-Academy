import { expect, test } from '@playwright/test';
import { startStaticServer } from './serve-dist';

/**
 * The hero photograph downloads exactly once, on the home page only, in the right crop.
 *
 * It is preloaded from index.html so it no longer waits for Angular to boot — that took LCP back
 * from ~3.7–4.0 s to ~2.9 s. A preload can go wrong in two quiet ways, and both are asserted here
 * against the production build:
 *  - a DOUBLE download, when the preload and the <picture> disagree about which file to use;
 *  - a LEAK, when a student opening any other route is made to pay for marketing imagery on their
 *    data (P6). index.html serves every route, so this is the default unless it is scoped.
 */

let stop: (() => void) | undefined;
let origin = '';

test.beforeAll(async () => {
  const { server, port } = await startStaticServer(4396);
  origin = `http://127.0.0.1:${port}`;
  stop = () => server.close();
});

test.afterAll(() => stop?.());

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, crop: /^hero-mobile-\d+\.avif$/ },
  { name: 'desktop', width: 1280, height: 720, crop: /^hero-desktop-\d+\.avif$/ },
];

async function heroRequests(page: import('@playwright/test').Page, route: string) {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/images/hero/')) {
      requested.push(request.url().split('/').pop() ?? '');
    }
  });
  await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  return requested;
}

for (const viewport of VIEWPORTS) {
  test(`home downloads one hero image, in the ${viewport.name} crop`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const requested = await heroRequests(page, '/');

    expect(requested, 'the preload and the <picture> disagreed, so it downloaded twice').toHaveLength(1);
    expect(requested[0]).toMatch(viewport.crop);
  });

  for (const route of ['/bursaries', '/auth/login', '/how-it-works']) {
    test(`${route} downloads no hero image (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      expect(await heroRequests(page, route)).toEqual([]);
    });
  }
}
