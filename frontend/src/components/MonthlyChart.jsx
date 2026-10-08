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
      count: entry?.count ?? 0,
    })
  }

  return series
}

export default function MonthlyChart({ months, loading }) {
  const series = buildSeries(months)
  const peak = Math.max(...series.map((entry) => entry.total))

  return (
    <section className="panel chart">
      <h2>Spending by month</h2>

      {loading && <p className="hint">Consulting the ledger…</p>}

      {!loading && peak === 0 && <p className="hint">No spending recorded yet.</p>}

      {!loading && peak > 0 && (
        <div className="bars">
          {series.map((entry) => (
            <div className="bar-slot" key={entry.key}>
              <span className="bar-value">
                {entry.total > 0 ? formatAmount(entry.total) : '—'}
              </span>
              <div className="bar-track">
                <div
                  className="bar"
                  style={{ height: `${Math.max((entry.total / peak) * 100, 1.5)}%` }}
                  title={`${entry.label} ${entry.key}: ${formatAmount(entry.total)} across ${entry.count} entries`}
                />
              </div>
              <span className="bar-label">{entry.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
