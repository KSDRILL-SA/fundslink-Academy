/**
 * Serve the PRODUCTION build, with /api proxied to the real API.
 *
 * Core Web Vitals measured against `ng serve` are fiction: that build has
 * optimization off, no minification and no output hashing, so LCP reflects the
 * dev server rather than what a student on a phone in Polokwane downloads.
 * G4's budget is a *transfer* budget on an optimised bundle, so the thing under
 * measurement has to be `dist/`.
 *
 * It BROTLI-compresses text responses (gzip as a fallback), and that is not an
 * optimisation — it is required for
 * the measurement to be honest. Serving raw bytes made the first run report
 * 461 kB against a 200 kB budget, because Angular's "estimated transfer size"
 * assumes compression and every real host (Vercel, a CDN) sends brotli or gzip.
 * Measuring uncompressed would have failed the gate on an artefact of the test
 * harness and sent someone hunting a bundle problem that does not exist.
 *
 * Deliberately tiny and dependency-free — a test harness that needs its own
 * dependency tree is a second thing to maintain and to get wrong.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

// Playwright runs from apps/web, and its transpile target has no import.meta.
const ROOT = join(process.cwd(), 'dist', 'web', 'browser');
const API = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:8000';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

/** Forward /api to the real backend, cookies and all — the session depends on them. */
async function proxy(req: any, res: any) {
  const headers = { ...req.headers };
  delete headers.host; // let fetch set it for the upstream origin
  delete headers['accept-encoding']; // we re-send a decoded body

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    const upstream = await fetch(`${API}${req.url}`, {
      method: req.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: 'manual',
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const out: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      // set-cookie must survive as-is; content-length is recomputed.
      if (key !== 'content-encoding' && key !== 'content-length') out[key] = value;
    });
    const cookies = upstream.headers.getSetCookie?.() ?? [];
    res.writeHead(upstream.status, cookies.length ? { ...out, 'set-cookie': cookies } : out);
    res.end(body);
  } catch (cause) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'proxy_failed', message: String(cause) } }));
  }
}

export function startStaticServer(port = 4399): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    if (req.url.startsWith('/api/')) return void proxy(req, res);

    const path = decodeURIComponent(req.url.split('?')[0]);
    const candidate = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    // An Angular SPA serves index.html for every route it owns.
    const file =
      existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(ROOT, 'index.html');

    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const raw = readFileSync(file);
    // Compress what a CDN compresses. woff2/png are already compressed, and
    // gzipping them again would misreport them as larger than they ship.
    const compressible = /^(text\/|application\/(javascript|json)|image\/svg)/.test(type);
    // Brotli, because that is what Vercel serves (S8.3). Measuring with gzip
    // would overstate every figure by roughly 15%.
    const accept = String(req.headers['accept-encoding'] ?? '');
    const encoding = !compressible ? null : accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
    const body =
      encoding === 'br' ? brotliCompressSync(raw) : encoding === 'gzip' ? gzipSync(raw) : raw;

    res.writeHead(200, {
      'content-type': type,
      'content-length': String(body.byteLength),
      // Cache headers a real host would send. NOT no-store: that makes a
      // preloaded response unusable, so the browser fetches every preloaded
      // font a SECOND time for the CSS that references it. It cost ~66 kB of
      // phantom transfer and looked exactly like a duplicate-request bug in
      // the product. Playwright gives each test a fresh browser context, so
      // the load is cold without lying about caching.
      'cache-control': file.endsWith('index.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
      ...(encoding ? { 'content-encoding': encoding } : {}),
    });
    res.end(body);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, port }));
  });
}
