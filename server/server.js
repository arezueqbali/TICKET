import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { router } from './src/routes.js';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[server] STRIPE_SECRET_KEY is not set (server/.env) — payment endpoints will fail.');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// CORS enabled for the Vite dev server origin (and any localhost dev port, to be lenient).
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
// this and serves the API only, unaffected.
const distDir = process.env.STATIC_DIR || path.join(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-API GET that isn't a real static file goes to index.html
  // so client-side routes (e.g. a booking confirmation deep link) work on refresh.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexHtml);
  });
}

// Exported so an embedding host (e.g. the Electron desktop wrapper) can await
// server startup instead of guessing with a timer.
export const ready = new Promise((resolve) => {
  app.listen(PORT, () => {
    console.log(`CineBook API listening on http://localhost:${PORT}/api`);
    resolve();
  });
});
