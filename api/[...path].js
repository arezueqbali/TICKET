// Vercel serverless entry point. The filename `[...path].js` is Vercel's
// catch-all convention — every request under /api/* (movies, showtimes,
// bookings, payments/create-intent, health, ...) is routed to this one
// function, and Express's own router (server/src/app.js) does the real
// path matching from there, exactly as it does locally.
//
// See server/src/store.js for the one behavioral caveat of running this
// particular app on serverless: booking state lives in memory + a /tmp
// mirror per warm instance, not a durable database, so it can reset between
// cold starts and isn't guaranteed atomic across concurrent instances the
// way it is on a single always-on Node process. Fine for a demo; for
// production-grade correctness, host server/ on an always-on Node service
// instead and keep Vercel for the static frontend only.
import { app } from '../server/src/app.js';

export default app;
