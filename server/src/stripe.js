// Stripe SDK client, keyed from server/.env (STRIPE_SECRET_KEY). Never import this
// from anything that ships to the browser — it holds a secret/restricted key.
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
