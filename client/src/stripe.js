import { loadStripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!publishableKey) {
  console.warn('VITE_STRIPE_PUBLISHABLE_KEY is not set (client/.env) — payment will fail to load.')
}

// loadStripe() is safe to call once at module scope; it memoizes the underlying
// stripe.js script load, so every import of this module shares one instance.
export const stripePromise = loadStripe(publishableKey || '')
