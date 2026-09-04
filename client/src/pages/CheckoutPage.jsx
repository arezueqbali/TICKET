import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripePromise } from '../stripe'
import { getShowtime, createPaymentIntent, createBooking, ApiError } from '../api'
import { formatMoney, formatShowDate, formatShowTime, seatLabel } from '../format'
import './CheckoutPage.css'

// Matches the dark palette in index.css so Stripe's Payment Element doesn't look
// like a foreign widget dropped onto the page.
const STRIPE_APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#ff5470',
    colorBackground: '#171b2e',
    colorText: '#f2f3f8',
    colorTextSecondary: '#9aa0c0',
    colorDanger: '#ff5c5c',
    borderRadius: '6px',
    fontFamily: "'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif",
  },
}

export default function CheckoutPage() {
  const { id } = useParams()
  const location = useLocation()

  const selectedSeatIds = location.state?.selectedSeatIds
  const priceFromState = location.state?.price

  const [showtime, setShowtime] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [clientSecret, setClientSecret] = useState(null)
  const [intentError, setIntentError] = useState(null)

  useEffect(() => {
    if (!selectedSeatIds || selectedSeatIds.length === 0) return
    let cancelled = false
    getShowtime(id)
      .then((data) => {
        if (!cancelled) setShowtime(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err)
      })
    return () => {
      cancelled = true
    }
  }, [id, selectedSeatIds])

  // Once we know the showtime is real, ask the backend to start a Stripe payment
  // for these exact seats. This does not reserve the seats — that only happens
  // atomically once payment has actually succeeded (see POST /bookings).
  useEffect(() => {
    if (!showtime || !selectedSeatIds || selectedSeatIds.length === 0) return
    let cancelled = false
    createPaymentIntent({ showtimeId: id, seatIds: selectedSeatIds })
      .then((data) => {
        if (!cancelled) setClientSecret(data.clientSecret)
      })
      .catch((err) => {
        if (!cancelled) setIntentError(err)
      })
    return () => {
      cancelled = true
    }
  }, [showtime, id, selectedSeatIds])

  // No seats were carried over via navigation state (e.g. a hard refresh) —
  // send the customer back to pick seats again rather than showing a broken form.
  if (!selectedSeatIds || selectedSeatIds.length === 0) {
    return (
      <div className="page">
        <p className="state-message">Your seat selection expired or wasn't found.</p>
        <Link to={`/showtimes/${id}/seats`} className="btn btn-primary">Choose seats</Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page">
        <p className="state-message error">Couldn't load booking details: {loadError.message}</p>
        <Link to={`/showtimes/${id}/seats`} className="btn btn-secondary">Back to seats</Link>
      </div>
    )
  }

  if (intentError) {
    const message =
      intentError instanceof ApiError
        ? intentError.body?.message || intentError.message
        : intentError.message
    return (
      <div className="page">
        <p className="state-message error">Couldn't start payment: {message}</p>
        <Link to={`/showtimes/${id}/seats`} className="btn btn-secondary">Back to seats</Link>
      </div>
    )
  }

  if (!showtime || !clientSecret) {
    return (
      <div className="page">
        <p className="state-message">Loading&hellip;</p>
      </div>
    )
  }

  const selectedSeats = showtime.seats.filter((s) => selectedSeatIds.includes(s.id))
  const price = priceFromState ?? showtime.price
  const total = price * selectedSeatIds.length

  return (
    <div className="page checkout-page">
      <h1 className="checkout-title">Checkout</h1>
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
        <CheckoutForm
          showtimeId={id}
          showtime={showtime}
          selectedSeatIds={selectedSeatIds}
          selectedSeats={selectedSeats}
          price={price}
          total={total}
        />
      </Elements>
    </div>
  )
}

function CheckoutForm({ showtimeId, showtime, selectedSeatIds, selectedSeats, price, total }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitError(null)
    setSubmitting(true)

    const { error: elementsError } = await elements.submit()
    if (elementsError) {
      setSubmitError(elementsError)
      setSubmitting(false)
      return
    }

    // redirect: 'if_required' keeps the customer on this page for payment methods
    // (like test cards) that don't need an off-site redirect step.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        payment_method_data: {
          billing_details: { name, email },
        },
      },
    })

    if (confirmError) {
      setSubmitError(confirmError)
      setSubmitting(false)
      return
    }

    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      setSubmitError({ message: `Payment did not complete (status: ${paymentIntent?.status || 'unknown'}).` })
      setSubmitting(false)
      return
    }

    try {
      const booking = await createBooking({
        showtimeId,
        seatIds: selectedSeatIds,
        customer: { name, email },
        paymentIntentId: paymentIntent.id,
      })
      navigate(`/confirmation/${booking.reference}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Payment succeeded but someone else grabbed a seat first (or a duplicate
        // submit) — the server auto-refunds in this case. Send the customer back
        // to a freshly re-fetched seat map instead of leaving them stuck here.
        navigate(`/showtimes/${showtimeId}/seats`, {
          replace: true,
          state: {
            conflictMessage:
              err.body?.message ||
              'One or more of your selected seats were just booked by someone else. Your payment has been refunded.',
          },
        })
        return
      }
      setSubmitError(err)
      setSubmitting(false)
    }
  }

  return (
    <div className="checkout-layout">
      <form className="checkout-form card" onSubmit={handleSubmit}>
        <h2 className="section-heading">Customer info</h2>
        <label className="field">
          <span>Full name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            autoComplete="email"
          />
        </label>

        <h2 className="section-heading">Payment</h2>
        <p className="mock-payment-note">
          Test mode &mdash; use card 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
        <PaymentElement options={{ fields: { billingDetails: { name: 'never', email: 'never' } } }} />

        {submitError && <div className="banner banner-error">{submitError.message}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !stripe || !elements}>
          {submitting ? 'Processing payment…' : `Pay ${formatMoney(total)}`}
        </button>
      </form>

      <aside className="checkout-summary card">
        <h2 className="section-heading">Order summary</h2>
        <p className="summary-movie">{showtime.movie.title}</p>
        <p className="summary-meta">
          {showtime.cinema.name} &bull; {formatShowDate(showtime.startTime)} at {formatShowTime(showtime.startTime)}
        </p>
        <div className="summary-seats">
          <span>Seats</span>
          <span>{selectedSeats.map(seatLabel).sort().join(', ')}</span>
        </div>
        <div className="summary-line">
          <span>Price per seat</span>
          <span>{formatMoney(price)}</span>
        </div>
        <div className="summary-line">
          <span>Seats &times; {selectedSeatIds.length}</span>
          <span>{formatMoney(total)}</span>
        </div>
        <div className="summary-total">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
      </aside>
    </div>
  )
}
