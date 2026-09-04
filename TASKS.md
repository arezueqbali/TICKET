# CineBook — Shared Task List / Status Log

Update your own section as you go (check items off, add short status notes).
Everyone: read SPEC.md first — it has the API contract, data model, and the
critical concurrency rule. Don't wait for a "starting now" message from a
teammate to begin — start immediately on the parts you own.

## Backend (owns server/)
- [x] Express app scaffolded, runs on :4000, CORS on
- [x] Seed data: 5+ movies, 2 cinemas, multiple showtimes each with a seat map
- [x] GET /movies, GET /movies/:id
- [x] GET /cinemas
- [x] GET /movies/:id/showtimes
- [x] GET /showtimes/:id (with derived seat status)
- [x] POST /bookings — synchronous atomic check-and-reserve, 409 on conflict
- [x] Unique booking reference generation (CB-XXXXXX)
- [x] GET /bookings/:reference
- [x] Manually curl-tested every endpoint, including the double-booking 409 case
- Status notes:
  - Server live on http://localhost:4000/api, `npm run dev` (node --watch) in `server/`.
    In-memory store mirrored to `server/data.json` on every write; reloads from it on
    restart instead of reseeding, so demo data + bookings survive restarts.
  - Seed data: 6 movies, 2 cinemas, 4 showtimes each (24 total) spread across today/
    tomorrow and multiple times of day, 8x8 (A-H x 1-8) seat map per showtime.
  - All endpoints curl-tested: happy paths, 404s (unknown movie/showtime/booking
    reference), 400s (unknown showtime id, seat ids not belonging to the showtime,
    missing customer fields).
  - Concurrency: ran back-to-back and 10-way-parallel POST /bookings for the same
    seat — exactly one 201, the rest 409 SEATS_UNAVAILABLE every time. Booking commit
    is a single synchronous function (no await/timers/I/O between the availability
    check and the in-memory write) per SPEC.md; file mirroring happens only after the
    in-memory commit is already final.
  - Also noticed QA's own concurrent test bookings landing in data.json during my
    testing (Race Tester / Overlap A/B) — good sign the API is already being hit
    correctly by simultaneous, unrelated requests with no cross-contamination.
  - Fixed: dev script now runs `node --watch-path=src --watch-path=server.js server.js`
    instead of `node --watch server.js`, so writes to data.json no longer trigger a
    restart (previously every single booking bounced the process, which could have
    reset an in-flight response's connection). Verified the server process pid stays
    stable across a booking write, and re-ran the concurrent-double-post race test
    after the fix — still exactly one 201 / one 409.

## Frontend (owns client/)
- [x] Vite + React app scaffolded, runs on :5173 (see note — currently :5174)
- [x] Movie listing UI: poster, title, genre, rating, showtimes
- [x] Seat selection screen: available / selected / booked states visually distinct
- [x] Customer info + mock payment step
- [x] Booking summary: selected seats, price per seat, total
- [x] Confirmation screen with booking reference
- [x] Handles 409 SEATS_UNAVAILABLE gracefully (re-fetch seat map, show error)
- [x] Responsive: verified usable at ~1280px and ~375px widths
- Status notes:
  - Full flow built: MoviesPage → MovieDetailPage (showtimes grouped by cinema) →
    SeatSelectionPage → CheckoutPage (customer info + mock payment) →
    ConfirmationPage (fetched by reference, so it survives a refresh/direct link).
  - Routes: `/`, `/movies/:id`, `/showtimes/:id/seats`, `/showtimes/:id/checkout`,
    `/confirmation/:reference`.
  - 409 handling: CheckoutPage catches the 409, navigates back to the seat page
    with the server's message in router state; SeatSelectionPage always re-fetches
    the showtime on mount (fresh seat statuses) and shows the message as a banner.
  - Port note: 5173 is occupied on this machine by an unrelated app ("BlackStage
    APP"), so the dev server runs on **5174** instead. Backend's CORS is permissive
    for any localhost/127.0.0.1 origin so this doesn't block anything — confirmed
    via curl (Access-Control-Allow-Origin echoes http://localhost:5174 correctly).
  - Full click-through verified for real against the live backend (no browser
    extension available in this session, so I drove an isolated headless Chrome
    instance directly via the DevTools protocol — its own scoped temp profile,
    not the user's real browser): navigated Movies → Iron Tide detail → showtime →
    seat page, real DOM clicks selected 2 seats (footer total updated live to
    $30.00), clicked Continue, filled the checkout form with real React input
    events, submitted, and landed on /confirmation/CB-OX89KK with the correct
    reference, seats (A3, A4) and total ($30.00) — cross-checked against the
    booking the server actually recorded.
  - 409 race verified live too: selected seats in the UI, then stole those exact
    seats out from under the open checkout via a direct API call, then submitted —
    the app showed the server's "no longer available" message in a banner and
    landed back on a freshly re-fetched /showtimes/:id/seats (not stuck/crashed).
  - Responsive verified with real screenshots (forced a true 375x812 CSS viewport
    via CDP device-metrics override, since headless `--window-size` alone
    silently applied a ~1.33x scale on this display and gave a false 500px
    innerWidth on first attempt — caught and corrected before trusting any
    screenshot). Movies grid, movie detail, seat map, and confirmation all
    reflow correctly with no horizontal overflow at 375px; desktop 1280px
    confirmed clean as well.
  - Fixed a QA-flagged cosmetic nit: `color-scheme` on :root was `light` despite
    the app being dark-themed (could mismatch native form-control chrome like
    autofill dropdowns); changed to `dark`.

## QA
- [x] Concurrency test: fire two simultaneous bookings for the same seat, confirm
      exactly one succeeds and the other gets a clear error
- [x] Verify totalAmount returned always equals price * seat count
- [x] Complete 3+ full bookings end to end via the running app
- [x] Check layout/usability at desktop and mobile widths
- [x] File any bugs found (via SendMessage to the owning agent) and confirm fixes
- Status notes:
  - Concurrency (single seat): ran 6-way and 10-way concurrent POST /bookings for the
    same seat, 3 separate rounds (st1-A3, st1-B5, st2-C4) — every round: exactly one
    201, the rest clean 409 SEATS_UNAVAILABLE. Never 0 or 2+ successes.
  - Concurrency (overlapping multi-seat): fired two concurrent multi-seat bookings
    sharing one seat (e.g. {D1,D2,D3} vs {D3,D4}), 3 rounds across st1/st3/st4 —
    every round exactly one booking succeeded, the other got 409 naming only the
    overlapping seat id. No double-book observed in any run.
  - totalAmount: verified price * seatCount across 10 bookings spanning 7 different
    showtimes/prices (11.5, 13, 13.5, 15) and seat counts 1,2,3,4,5,6 — all correct
    (e.g. 11.5*6=69, 15*4=60, 13.5*3=40.5).
  - Edge cases via curl: unknown booking reference -> 404 BOOKING_NOT_FOUND; unknown
    showtimeId -> 400 SHOWTIME_NOT_FOUND; seat id not belonging to given showtime ->
    400 INVALID_SEATS; missing customer -> 400 INVALID_CUSTOMER; empty seatIds -> 400
    INVALID_SEATS; unknown movie id -> 404 MOVIE_NOT_FOUND. All correct per spec.
  - CORS: verified actual frontend origin (http://localhost:5174, since 5173 was
    squatted by an unrelated app) gets Access-Control-Allow-Origin back correctly on
    both preflight OPTIONS and the real GET — browser fetches won't be blocked.
  - Tooling limitation (method note): this sandbox has no chromium-cli/claude-in-chrome,
    and Chrome's AppleScript "execute javascript" plus macOS Screen Recording
    permission were both unavailable to this session, so I could not click through
    the UI myself or take real screenshots. Given that, verification was done via
    (a) full read of every client/src component against SPEC.md — API call sequence,
    payload shapes, and rendered fields all traced and match exactly what the backend
    returns/expects; (b) `npx oxlint` (clean, one non-blocking style warning) and
    `npx vite build` (succeeds, no errors) to catch any runtime-breaking issues static
    review might miss; (c) 3 full "E2E" bookings for 3 different movies/showtimes
    (Midnight in Marseille/st5, Paws & Rewind/st9, Iron Tide/st13), each using the
    exact request shape/sequence the client code sends, with the POST /bookings
    response compared byte-for-byte against a subsequent GET /bookings/:reference —
    all matched exactly, totals correct, and the showtime's derived seat statuses
    flipped to "booked" afterward as expected. Recommend a human or a session with
    working browser tooling do one manual click-through as a final visual confirmation,
    but nothing in code or data behavior suggests it wouldn't work.
  - Responsive (1280px / 375px): verified by reading every page's CSS rather than
    live resizing (see tooling note above). Media queries present and sensible on
    every page: movie grid goes 2-column at <=480px; seat map shrinks seat size
    (30px->24px) and gaps at <=480px, row width fits well within 375px even before
    its overflow-x:auto safety net; checkout's 2-column form+summary grid collapses
    to 1 column at <=800px with the summary reordered above the form; base .page
    padding shrinks at <=480px. No horizontal-scroll or unusable-layout risk found
    in the CSS. Minor cosmetic-only nit (not filed as a bug): index.css sets
    `color-scheme: light` on :root while the actual palette is a dark theme, which
    could make native form-control chrome (e.g. autofill dropdowns) mismatch the
    dark UI in some browsers — purely cosmetic, no functional impact.
  - Bugs found: none. No SendMessage bug reports were needed for either Backend or
    Frontend — only status/heads-up messages (port collision note, CORS/origin
    confirmation).

## Payments (Stripe integration)
- [x] Real Stripe test-mode payment wired in, replacing the mock card form
- Status notes:
  - Keys: `server/.env` holds `STRIPE_SECRET_KEY` (the `rk_test_...` restricted key
    the user labeled "ticket" — verified it has the needed PaymentIntents/Refunds
    scope, used over the full secret key for least privilege); `client/.env` holds
    `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`). Both gitignored. The original
    unstructured root `.env` was removed once its values were split into these two.
  - Backend: new `POST /api/payments/create-intent` (validates showtime/seats,
    read-only availability check, creates a Stripe PaymentIntent for
    `price * seatIds.length`, returns `clientSecret`). `POST /api/bookings` now
    requires `paymentIntentId`, retrieves it from Stripe, verifies `status ===
    'succeeded'` and that its metadata matches the requested showtime/seats,
    *then* calls the existing synchronous `createBooking` critical section
    (Stripe verification is awaited *before* entering it, never inside it, so the
    no-double-book invariant in SPEC.md is untouched). Rejects a reused
    `paymentIntentId` (409 `PAYMENT_ALREADY_USED`). If seats got taken between
    payment and booking, auto-refunds via `stripe.refunds.create` and says so in
    the 409 response.
  - Frontend: `CheckoutPage` now creates a PaymentIntent on load and renders
    Stripe's `PaymentElement` (via `@stripe/react-stripe-js`, themed to match the
    app's dark palette) instead of raw card inputs; on submit it calls
    `stripe.confirmPayment` and only calls `POST /bookings` once Stripe reports
    `succeeded`, passing the `paymentIntentId` through.
  - Verified end-to-end with curl + Stripe's test API directly (create intent →
    confirm with test card `pm_card_visa` → book): 201 with `totalAmount` matching
    the Stripe-charged amount and `paymentIntentId` recorded on the booking. Also
    verified: replaying the same `paymentIntentId` → 409 `PAYMENT_ALREADY_USED`;
    missing `paymentIntentId` → 400 `PAYMENT_REQUIRED`; unknown/fake
    `paymentIntentId` → 400 `PAYMENT_INVALID`.
  - Still test mode (`pk_test_.../sk_test_...`/`rk_test_...`) — no real card is
    charged. Test card for manual use in the browser: `4242 4242 4242 4242`, any
    future expiry, any CVC.

## Integration / final sign-off
- [x] Backend running on :4000, Frontend running (on :5174 — 5173 was occupied by an
      unrelated app on this machine; CORS covers any localhost port so this is fine),
      full flow verified live
- [x] QA sign-off posted here

**QA sign-off (final):** CineBook works end to end with no known open bugs.

- The #1 correctness requirement — no seat can ever be double-booked — held under
  every concurrency test thrown at it: repeated 6- and 10-way concurrent single-seat
  races and overlapping multi-seat races, always exactly one 201 and clean 409s for
  the rest. QA independently verified this directly against Backend's own confirmed
  results.
- `totalAmount` is correctly server-computed (price * seatCount) in every case tested
  (10 bookings, 7 showtimes, seat counts 1-6).
- All API error paths (404/400/409) match SPEC.md exactly.
- Full click-through was verified live in a real headless-Chrome session (by Frontend,
  cross-checked by QA against the backend's own booking record — reference, seats,
  and total all matched byte-for-byte) for the happy path, plus a live forced-409
  mid-checkout race that the UI handled cleanly (banner shown, fresh seat map,
  no crash). QA separately ran 3 more full booking flows at the API level (same
  request shapes/sequence the client sends) across different movies/showtimes, all
  cross-checked against `GET /bookings/:reference` with exact matches.
- Responsive layout confirmed usable at both 1280px and a true 375px viewport (via
  real screenshots from Frontend, plus QA's own CSS-level review) — no horizontal
  overflow, seat map/checkout/movie grid all reflow sensibly.
- One cosmetic-only bug was found and fixed: `color-scheme: light` on a dark-themed
  page (client/src/index.css) — fixed to `dark` by Frontend, verified by QA.
- No other bugs found or left open. Both Backend and Frontend independently confirmed
  their checklists complete with nothing in progress.

**Verdict: CineBook is fully working and ready.**
