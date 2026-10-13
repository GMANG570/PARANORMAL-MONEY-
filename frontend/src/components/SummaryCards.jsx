import { formatAmount } from '../format.js'

export default function SummaryCards({ summary }) {
  const top = summary?.by_category?.[0]
  const net = summary?.net ?? 0
  const pending = summary?.income_pending ?? 0

  return (
    <section className="cards">
      <article className="card">
        <h2>Total spent</h2>
        <p className="value">{formatAmount(summary?.total)}</p>
        <p className="hint">across {summary?.count ?? 0} entries</p>
      </article>
      <article className="card">
        <h2>Total earned</h2>
        <p className="value">{formatAmount(summary?.income_total)}</p>
        <p className="hint">
          {summary?.income_count ?? 0} entries
          {pending > 0 ? ` · ${formatAmount(pending)} pending` : ''}
        </p>
      </article>
      <article className="card">
        <h2>Net</h2>
        <p className={net >= 0 ? 'value net-up' : 'value net-down'}>{formatAmount(net)}</p>
        <p className="hint">earned minus spent</p>
      </article>
      <article className="card">
        <h2>Biggest drain</h2>
        <p className="value">{top ? formatAmount(top.total) : '—'}</p>
        <p className="hint">{top ? top.category : 'no entries yet'}</p>
      </article>
    </section>
  )
}
