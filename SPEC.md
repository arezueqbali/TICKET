# CineBook — Shared Spec (source of truth)

Read this in full before writing code. This is the contract the whole team builds
against, so nobody should have to guess or renegotiate the basics — use SendMessage
to your teammates only for real integration questions, bug reports, and status, not
to re-derive what's already written here.

## Team

- **Backend** — owns `server/`
- **Frontend** — owns `client/`
- **QA** — tests both, files bugs, confirms fixes

Talk to each other by name with SendMessage. Update `TASKS.md` (same folder as this
file) as you complete items so the others can see progress without asking.

## Project layout

```
/Users/mac/Desktop/Booking Ticket/
  SPEC.md        <- this file
  TASKS.md        <- shared checklist / status log
  server/        <- Backend's Node/Express API
  client/        <- Frontend's React/Vite app
```

## Tech stack (fixed — don't relitigate)

- **Backend**: Node.js + Express. Data lives in-memory in a single module, mirrored
  to a JSON file on every write so it survives a restart. No external DB required.
  Runs on **port 4000**. All routes under `/api`. CORS enabled for the Vite dev
  server origin.
- **Frontend**: React + Vite. Plain CSS (flexbox/grid + media queries) for
  responsiveness — no CSS framework required, but Tailwind via npm is fine if
  preferred. Talks to the backend via `fetch` against `http://localhost:4000/api`.
  Runs on Vite's default **port 5173**.
- **Seed data**: ship the app with realistic seed data baked into the backend at
  startup — at least 5 movies (title, genre, rating, poster image URL — use
  `https://picsum.photos/seed/<slug>/300/450` style placeholders, duration,
  short description), 2 cinemas, and enough showtimes (several per movie, spread
  across both cinemas and multiple times of day) that the app is fully demoable
  with zero setup. Each showtime has its own seat map, e.g. 8 rows (A–H) x 8 seats
  = 64 seats, laid out with a center aisle.

## Data model

```
Movie      { id, title, genre, rating, durationMinutes, posterUrl, description }
Cinema     { id, name, location }
Showtime   { id, movieId, cinemaId, startTime (ISO string), price (number, per seat) }
Seat       { id, showtimeId, row (letter), number (int) }
             status is NOT stored on the seat — it's derived: a seat is "booked" for
             a showtime iff it appears in a booking's seatIds for that showtime.
Booking    { reference, showtimeId, seatIds[], customer: {name, email},
             totalAmount, createdAt }
```

## API contract (Backend implements exactly this; Frontend codes against exactly this)

Base URL: `http://localhost:4000/api`

- `GET /movies` → `[{ id, title, genre, rating, durationMinutes, posterUrl, description }]`
- `GET /movies/:id` → single movie, 404 if not found
- `GET /cinemas` → `[{ id, name, location }]`
- `GET /movies/:id/showtimes` → `[{ id, movieId, cinemaId, cinemaName, startTime, price }]`
  (showtimes for that movie, across all cinemas)
- `GET /showtimes/:id` → full detail for the seat-selection screen:
  `{ id, movie: {...}, cinema: {...}, startTime, price, seats: [{ id, row, number, status: "available" | "booked" }] }`
- `POST /bookings` — body `{ showtimeId, seatIds: [...], customer: { name, email } }`
  - success → **201** `{ reference, showtimeId, seatIds, totalAmount, customer, createdAt }`
  - any requested seat already booked → **409**
    `{ error: "SEATS_UNAVAILABLE", unavailableSeatIds: [...], message: "<human readable>" }`
  - unknown showtime / seat ids not belonging to that showtime → **400** with a clear message
- `GET /bookings/:reference` → booking detail, for the confirmation screen /
  "look up my booking". 404 if not found with a clear error body.

`totalAmount` is always computed **server-side** as `price * seatIds.length` — the
server is the source of truth. The frontend may compute the same number for instant
UI feedback before submitting, but must display what the server returns after booking.

### The one rule that matters: no seat double-books

The check-availability-then-reserve step for `POST /bookings` MUST be a single
synchronous block with **no `await` between reading seat state and committing the
booking**. Node is single-threaded per event-loop turn, so a purely synchronous
check-and-write is naturally atomic against concurrent requests — two simultaneous
`POST /bookings` for the same seat will not interleave as long as nothing yields
the event loop in between. Do not use `async`/`await`, timers, or I/O inside that
critical section. This is the mechanism that satisfies "the same seat can never be
booked twice for the same showtime" — Backend, treat it as the top priority
correctness requirement, and QA, this is the #1 thing to try to break.

Booking references: format `CB-XXXXXX` (6 uppercase alphanumeric chars), checked
for uniqueness against existing bookings before being assigned (regenerate on
collision).

## Definition of done

- Backend: `npm install && npm run dev` in `server/` starts the API on :4000 with
  seed data loaded, all endpoints above implemented and manually curl-tested.
- Frontend: `npm install && npm run dev` in `client/` starts the app on :5173,
  full flow works clicking through a real browser: browse movies → pick a
  showtime → select seats (available/selected/booked all visually distinct) →
  enter customer info → pay (a simple mock payment form is fine, no real payment
  gateway) → see a confirmation screen with reference, seats, and total. Layout
  is usable at both a desktop width (~1280px) and a phone width (~375px).
- QA: has actually run the double-booking race test and watched it get rejected,
  has completed several full bookings end-to-end and checked totals match, and
  has sanity-checked the layout at desktop and mobile widths. Bugs found were
  sent (via SendMessage) to the owning agent, and QA confirmed each fix.
