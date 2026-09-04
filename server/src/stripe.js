// Stripe SDK client, keyed from STRIPE_SECRET_KEY (server/.env locally, a Vercel
// Project Environment Variable in production). Never import this from anything
// that ships to the browser — it holds a secret/restricted key.
//
// Deliberately does NOT throw at import time when the key is missing: this module
// is imported by server/src/app.js, which handles every /api route, not just
// payments. Crashing here would take down movie/cinema/showtime browsing too. A
// missing key instead surfaces as a normal, catchable error only when a payment
// endpoint actually tries to call Stripe (see routes.js's try/catch there).
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key
  ? new Stripe(key)
  : new Proxy(
      {},
      {
        get() {
          throw new Error('STRIPE_SECRET_KEY is not configured on the server.');
        },
      }
    );
