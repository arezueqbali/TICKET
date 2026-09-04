// Seed data generation for CineBook.
// Produces movies, cinemas, and showtimes (with a fresh 8x8 seat map per showtime).
// Dates are generated relative to "today" so the demo always looks current.

const MOVIES = [
  {
    id: 'm1',
    title: 'The Last Horizon',
    genre: 'Sci-Fi',
    rating: 'PG-13',
    durationMinutes: 128,
    posterUrl: 'https://picsum.photos/seed/last-horizon/300/450',
    description:
      'A deep-space salvage crew stumbles on a signal older than humanity itself, and ' +
      'must decide whether answering it is worth the cost.',
  },
  {
    id: 'm2',
    title: 'Midnight in Marseille',
    genre: 'Thriller',
    rating: 'R',
    durationMinutes: 112,
    posterUrl: 'https://picsum.photos/seed/midnight-marseille/300/450',
    description:
      'An insurance investigator chasing a stolen painting gets pulled into a decades-old ' +
      'feud between two rival smuggling families.',
  },
  {
    id: 'm3',
    title: 'Paws & Rewind',
    genre: 'Animation',
    rating: 'PG',
    durationMinutes: 95,
    posterUrl: 'https://picsum.photos/seed/paws-rewind/300/450',
    description:
      'A time-traveling shelter dog has one week to fix the day he ran away, before the ' +
      'family that loved him forgets he ever existed.',
  },
  {
    id: 'm4',
    title: 'Iron Tide',
    genre: 'Action',
    rating: 'PG-13',
    durationMinutes: 134,
    posterUrl: 'https://picsum.photos/seed/iron-tide/300/450',
    description:
      'A disgraced Navy engineer has to retake her own experimental submarine from the ' +
      'mercenaries who hijacked it, using nothing but what is already on board.',
  },
  {
    id: 'm5',
    title: 'The Quiet Orchard',
    genre: 'Drama',
    rating: 'PG-13',
    durationMinutes: 107,
    posterUrl: 'https://picsum.photos/seed/quiet-orchard/300/450',
    description:
      'Three estranged siblings return to their late father\'s orchard for one final harvest, ' +
      'and find out why he really left it to all of them together.',
  },
  {
    id: 'm6',
    title: 'Laugh Track',
    genre: 'Comedy',
    rating: 'PG-13',
    durationMinutes: 99,
    posterUrl: 'https://picsum.photos/seed/laugh-track/300/450',
    description:
      'A washed-up sitcom writer is hired to punch up a live studio audience\'s actual lives, ' +
      'whether they asked for it or not.',
  },
];

const CINEMAS = [
  { id: 'c1', name: 'CineBook Downtown', location: '120 Main St, Downtown' },
  { id: 'c2', name: 'CineBook Riverside', location: '48 Harbor Ave, Riverside' },
];

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 8;

function buildSeatsForShowtime(showtimeId) {
  const seats = [];
  for (const row of ROWS) {
    for (let number = 1; number <= SEATS_PER_ROW; number++) {
      seats.push({ id: `${showtimeId}-${row}${number}`, showtimeId, row, number });
    }
  }
  return seats;
}

function isoAt(dayOffset, hour, minute) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// [dayOffset, hour, minute] slots, spread across today and tomorrow.
const TIME_SLOTS = [
  [0, 11, 0],
  [0, 14, 30],
  [0, 18, 0],
  [0, 21, 15],
  [1, 12, 0],
  [1, 17, 30],
];

function priceFor(cinemaId, hour) {
  const base = cinemaId === 'c1' ? 13.5 : 11.5;
  const eveningSurcharge = hour >= 18 ? 1.5 : 0;
  return Math.round((base + eveningSurcharge) * 100) / 100;
}

export function buildSeedData() {
  const movies = MOVIES;
  const cinemas = CINEMAS;
  const showtimes = [];
  const seatsByShowtime = {};

  let showtimeCounter = 1;
  movies.forEach((movie, movieIndex) => {
    // 4 showtimes per movie, alternating cinemas and picking varied time slots
    // so every movie plays at both cinemas at multiple times of day.
    for (let i = 0; i < 4; i++) {
      const cinema = cinemas[i % cinemas.length];
      const slot = TIME_SLOTS[(movieIndex + i) % TIME_SLOTS.length];
      const [dayOffset, hour, minute] = slot;
      const showtimeId = `st${showtimeCounter++}`;
      const startTime = isoAt(dayOffset, hour, minute);
      showtimes.push({
        id: showtimeId,
        movieId: movie.id,
        cinemaId: cinema.id,
        startTime,
        price: priceFor(cinema.id, hour),
      });
      seatsByShowtime[showtimeId] = buildSeatsForShowtime(showtimeId);
    }
  });

  return { movies, cinemas, showtimes, seatsByShowtime };
}
