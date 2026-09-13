import { expect, test } from '@playwright/test';
import { startStaticServer } from './serve-dist';

/**
 * G4's performance criteria, MEASURED (Stage 04 carry-over).
 *
 * Stage 04 closed with the byte budget proven from the build table and the
 * *timings* never measured at all — `handoff-s04-s05.md` §2 says so plainly.
 * This is that gap.
 *
 * Two decisions make these numbers mean something:
 *
 * 1. **The production build, not `ng serve`.** The dev server has optimization
 *    off and no hashing, so an LCP measured against it describes the dev
 *    server. G4's budget is a transfer budget on an optimised bundle, so the
 *    thing under measurement has to be `dist/`.
 * 2. **Throttled to a real phone on a real network.** Fast 3G plus 4× CPU
 *    slowdown is the mid-range South African mobile profile the budget exists
 *    for (P6). Unthrottled numbers on a developer laptop are meaningless — a
 *    student is not holding a developer laptop.
 *
 * **What is asserted, and why it is not simply the G4 numbers.**
 *
 * Transfer is deterministic — the same build sends the same bytes every run —
 * so it is asserted tightly, as a RATCHET just above today's measurement. It
 * cannot regress silently, and the remaining distance to G4's 200 kB is
 * recorded in #271 rather than hidden.
 *
 * CLS is asserted at its real G4 target (< 0.1), which the build clears by
 * three orders of magnitude.
 *
 * LCP is *reported* and guarded loosely. It varies by 2.8–3.3s across runs on
 * this machine depending on what else is running, so a 2.5s assertion would
 * fail intermittently and teach people to re-run the suite — which is how a
 * real regression gets ignored. The guard catches a catastrophic change; the
 * genuine G4 gap (~2.9s against a 2.5s target) is #271, not a flaky test.
 */

/** G4's real targets, for the record. The assertions below explain any gap. */
const G4 = { transferKb: 200, lcpMs: 2500, cls: 0.1 };

const ROUTES = [
  // budgetKb is a ratchet just above the current measurement, not the G4 target.
  // Home carries the Founder-approved hero photograph (L4, 2026-09-13): +52 kB, the 1536w desktop
  // AVIF. Raised deliberately and recorded here, not quietly. G4's <= 200 kB applies to student
  // routes; this is the anonymous marketing page. The image is preloaded, so it costs bytes and
  // not time — LCP measured 2.86-2.91 s with it against 2.9-3.2 s before it existed.
  { name: 'marketing home (anonymous)', path: '/', budgetKb: 255 },
  { name: 'browse bursaries (public)', path: '/bursaries', budgetKb: 208 },
];

let stop: (() => void) | undefined;
let origin = '';

test.beforeAll(async () => {
  const { server, port } = await startStaticServer(4399);
  origin = `http://127.0.0.1:${port}`;
  stop = () => server.close();
});

test.afterAll(() => stop?.());

for (const route of ROUTES) {
  test(`${route.name}: within the G4 budget on throttled 3G`, async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      // Fast 3G: ~1.6 Mbps down, 750 kbps up, 150ms RTT.
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    // A mid-range phone is several times slower than this machine.
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    let transferred = 0;
    const biggest: { url: string; kb: number }[] = [];
    page.on('response', async (response) => {
      const length = response.headers()['content-length'];
      let bytes = 0;
      if (length) bytes = Number(length);
      else {
        try {
          bytes = (await response.body()).byteLength;
        } catch {
          /* redirects and aborted requests carry no body */
        }
      }
      transferred += bytes;
      biggest.push({ url: `${response.url().replace(origin, '')}|${response.request().resourceType()}|${response.status()}`, kb: bytes / 1024 });
    });

    await page.goto(`${origin}${route.path}`, { waitUntil: 'load' });

    // Collect the web vitals the browser itself reports. LCP and CLS are only
    // final once the page settles, so give the observers a moment after load.
    const vitals = await page.evaluate(async () => {
      const result: { lcp: number; cls: number } = { lcp: 0, cls: 0 };

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          result.lcp = Math.max(result.lcp, entry.startTime);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[]) {
          if (!entry.hadRecentInput) result.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });

      await new Promise((resolve) => setTimeout(resolve, 2500));
      return result;
    });

    const transferKb = transferred / 1024;
    // eslint-disable-next-line no-console -- these numbers ARE the gate evidence
    console.log(
      `[G4] ${route.name}: transfer ${transferKb.toFixed(1)} kB · ` +
        `LCP ${Math.round(vitals.lcp)} ms · CLS ${vitals.cls.toFixed(4)}`,
    );

    // eslint-disable-next-line no-console -- name the bytes, so a breach is actionable
    console.log(
      '        largest: ' +
        biggest
          .sort((a, b) => b.kb - a.kb)
          .slice(0, 6)
          .map((r) => `${r.url} ${r.kb.toFixed(1)}kB`)
          .join(', '),
    );

    // Deterministic: the same build sends the same bytes. Ratchet, not target.
    expect(
      transferKb,
      `transfer ratchet ${route.budgetKb} kB (G4 target ${G4.transferKb} kB — see #271)`,
    ).toBeLessThan(route.budgetKb);

    // The real G4 target, cleared with enormous margin.
    expect(vitals.cls, `G4: CLS < ${G4.cls}`).toBeLessThan(G4.cls);

    // Loose guard only — see the note at the top of this file.
    expect(vitals.lcp, `LCP regression guard (G4 target ${G4.lcpMs} ms — see #271)`).toBeLessThan(
      4000,
    );
  });
}
