import './SeatMap.css'

const AISLE_AFTER = 4 // insert a center aisle gap after this many seats in a row

export default function SeatMap({ seats, selectedSeatIds, onToggleSeat }) {
  const rows = seats.reduce((acc, seat) => {
    if (!acc[seat.row]) acc[seat.row] = []
    acc[seat.row].push(seat)
    return acc
  }, {})

  const rowLetters = Object.keys(rows).sort()

  return (
    <div className="seat-map">
      <div className="screen-wrap">
        <div className="screen" />
        <span className="screen-label">SCREEN</span>
      </div>

      <div className="seat-rows">
        {rowLetters.map((row) => (
          <div key={row} className="seat-row">
            <span className="row-label">{row}</span>
            <div className="seat-row-seats">
              {rows[row]
                .slice()
                .sort((a, b) => a.number - b.number)
                .map((seat, idx) => {
                  const isSelected = selectedSeatIds.includes(seat.id)
                  const isBooked = seat.status === 'booked'
                  const state = isBooked ? 'booked' : isSelected ? 'selected' : 'available'
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className={`seat seat-${state}${idx === AISLE_AFTER ? ' aisle-before' : ''}`}
                      disabled={isBooked}
                      aria-pressed={isSelected}
                      aria-label={`Seat ${seat.row}${seat.number}, ${state}`}
                      onClick={() => onToggleSeat(seat)}
                    >
                      {seat.number}
                    </button>
                  )
                })}
            </div>
            <span className="row-label row-label-end">{row}</span>
          </div>
        ))}
      </div>

      <div className="seat-legend">
        <span className="legend-item">
          <span className="seat seat-available legend-swatch" aria-hidden="true" />
          Available
        </span>
        <span className="legend-item">
          <span className="seat seat-selected legend-swatch" aria-hidden="true" />
          Selected
        </span>
        <span className="legend-item">
          <span className="seat seat-booked legend-swatch" aria-hidden="true" />
          Booked
        </span>
      </div>
    </div>
  )
}
