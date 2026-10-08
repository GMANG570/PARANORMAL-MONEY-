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

export default function MonthlyChart({ months, loading }) {
  const series = buildSeries(months)
  const peak = Math.max(...series.map((entry) => Math.max(entry.total, entry.income)))
  const hasIncome = series.some((entry) => entry.income > 0)
  const hasPending = series.some((entry) => entry.pending > 0)

  return (
    <section className="panel chart">
      <div className="panel-head">
        <h2>Money out and in, by month</h2>
        {!loading && peak > 0 && hasIncome && (
          <p className="legend">
            <span className="swatch spend" /> out
            <span className="swatch income" /> in
            {hasPending && (
              <>
                <span className="swatch pending" /> pending
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
    </section>
  )
}
