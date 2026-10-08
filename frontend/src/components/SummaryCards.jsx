import { formatAmount } from '../format.js'

export default function SummaryCards({ summary }) {
  const total = formatAmount(summary?.total)
  const count = summary?.count ?? 0
  const top = summary?.by_category?.[0]

  return (
    <section className="cards">
      <article className="card">
        <h2>Total spent</h2>
        <p className="value">{total}</p>
        <p className="hint">across {count} entries</p>
      </article>
      <article className="card">
        <h2>Biggest drain</h2>
        <p className="value">{top ? formatAmount(top.total) : '—'}</p>
        <p className="hint">{top ? top.category : 'no entries yet'}</p>
      </article>
    </section>
  )
}
