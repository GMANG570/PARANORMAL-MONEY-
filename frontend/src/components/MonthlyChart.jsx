import { formatAmount } from '../format.js'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const VISIBLE_MONTHS = 6

// The API only returns months that have entries; fill the gaps so the trend reads
// across a steady window ending with the current month.
function buildSeries(months) {
  const byMonth = new Map(months.map((entry) => [entry.month, entry]))
  const now = new Date()
  const series = []

  for (let offset = VISIBLE_MONTHS - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const entry = byMonth.get(key)
    series.push({
      key,
      label: MONTH_LABELS[date.getMonth()],
      total: entry?.total ?? 0,
      income: entry?.income ?? 0,
      pending: entry?.income_pending ?? 0,
      confirmed: entry?.income_confirmed ?? 0,
    })
  }

  return series
}

const heightFor = (value, peak) => `${Math.max((value / peak) * 100, 1.5)}%`

const netOf = (entry) => entry.income - entry.total

const signed = (value) => `${value < 0 ? '−' : '+'}${formatAmount(Math.abs(value))}`

// Whole dollars only: the net strip has to stay readable at six columns on a phone.
const compact = (value) =>
  `${value < 0 ? '−' : '+'}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`

const netClass = (net) => (net === 0 ? 'even' : net > 0 ? 'up' : 'down')

const moved = (entry) => entry.total > 0 || entry.income > 0

export default function MonthlyChart({ months, loading }) {
  const series = buildSeries(months)
  const peak = Math.max(...series.map((entry) => Math.max(entry.total, entry.income)))
  const hasIncome = series.some((entry) => entry.income > 0)
  const hasPending = series.some((entry) => entry.pending > 0)

  const active = series.filter(moved)
  const peakNet = Math.max(...series.map((entry) => Math.abs(netOf(entry))), 0)
  const ranked = [...active].sort((a, b) => netOf(b) - netOf(a))
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const averageNet = active.length
    ? active.reduce((sum, entry) => sum + netOf(entry), 0) / active.length
    : 0
  const thisMonth = series[series.length - 1]
  const lastMonth = series[series.length - 2]
  const comparable = moved(thisMonth) && moved(lastMonth)
  const swing = netOf(thisMonth) - netOf(lastMonth)

  return (
    <section className="panel chart">
      <div className="panel-head">
        <h2>Money out and in, by month</h2>
        {!loading && peak > 0 && (
          <p className="legend">
            <span className="swatch spend" /> out
            {hasIncome && (
              <>
                <span className="swatch income" /> in
              </>
            )}
            {hasPending && (
              <>
                <span className="swatch pending" /> pending
              </>
            )}
            {peakNet > 0 && (
              <>
                <span className="swatch net" /> net
              </>
            )}
          </p>
        )}
      </div>

      {loading && <p className="hint">Consulting the ledger…</p>}

      {!loading && peak === 0 && <p className="hint">No money moved yet.</p>}

      {!loading && peak > 0 && (
        <div className="bars">
          {series.map((entry) => (
            <div className="bar-slot" key={entry.key}>
              <span className="bar-value">
                {entry.total > 0 ? formatAmount(entry.total) : '—'}
              </span>
              <div className="bar-track">
                <div className="bar-pair">
                  {entry.total > 0 && (
                    <div
                      className="bar"
                      style={{ height: heightFor(entry.total, peak) }}
                      title={`${entry.label}: ${formatAmount(entry.total)} spent`}
                    />
                  )}
                  {entry.income > 0 && (
                    <div
                      className="bar income"
                      style={{ height: heightFor(entry.income, peak) }}
                      title={`${entry.label}: ${formatAmount(entry.income)} in — ${formatAmount(
                        entry.confirmed,
                      )} confirmed, ${formatAmount(entry.pending)} pending`}
                    >
                      {entry.pending > 0 && (
                        <span
                          className="bar-pending"
                          style={{
                            height: `${Math.min((entry.pending / entry.income) * 100, 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="bar-label">{entry.label}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && peakNet > 0 && (
        <>
          <p className="hint strip-caption">net per month — green earned more, pink spent more</p>

          <div className="net-strip">
            {series.map((entry) => {
              const net = netOf(entry)
              return (
                <div className="net-cell" key={entry.key}>
                  <div
                    className="net-track"
                    title={`${entry.label}: ${signed(net)} net`}
                  >
                    <span className="net-axis" />
                    {net !== 0 && (
                      <span
                        className={`net-bar ${netClass(net)}`}
                        style={{
                          width: `${Math.max(
                            (Math.abs(net) / peakNet) * 50,
                            3,
                          )}%`,
                        }}
                      />
                    )}
                  </div>
                  <span className={`net-value ${netClass(net)}`}>
                    {moved(entry) ? compact(net) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {active.length > 0 && (
            <div className="trend-facts">
              <p>
                <span className="hint">best month</span>
                {best.label} {signed(netOf(best))}
              </p>
              <p>
                <span className="hint">worst month</span>
                {worst.label} {signed(netOf(worst))}
              </p>
              <p>
                <span className="hint">average net</span>
                {signed(averageNet)} a month
              </p>
              {comparable && (
                <p>
                  <span className="hint">vs last month</span>
                  {swing > 0 ? 'up' : swing < 0 ? 'down' : 'level'}
                  {swing !== 0 && ` ${formatAmount(Math.abs(swing))}`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
