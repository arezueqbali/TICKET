// Express app construction only — no `.listen()` here. Shared by:
//  - server/server.js (local dev / Electron desktop: listens on PORT)
//  - api/[...path].js (Vercel: the app itself is handed to Vercel's Node runtime
//    as the request handler, one invocation per request)
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[server] STRIPE_SECRET_KEY is not set — payment endpoints will fail.');
}

export const app = express();

// CORS: allow any localhost dev port, plus same-origin deployments (Vercel serves
// the client and API from the same domain, so browsers won't even send a CORS
// preflight there — this only matters for local dev / cross-origin setups).
app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  })
);
app.use(express.json());

app.use('/api', router);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 for anything under /api that didn't match a route above.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}.` });
});

// If a built frontend is sitting alongside this server (production / packaged-app
// layout: ../client/dist relative to this file), serve it from the same origin as
// the API. Optional — a plain `npm run dev` here with no client build just skips
// this and serves the API only, unaffected. (On Vercel the client is served by
// Vercel's static hosting instead, not through Express, so this stays a no-op there.)
const distDir = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'client', 'dist');
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-API GET that isn't a real static file goes to index.html
  // so client-side routes (e.g. a booking confirmation deep link) work on refresh.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexHtml);
  });
}
