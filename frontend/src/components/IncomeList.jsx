import { formatAmount, formatDate } from '../format.js'

export default function IncomeList({ income, onDelete, onError, loading }) {
  const handleDelete = async (id) => {
    try {
      await onDelete(id)
      onError('')
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <section className="panel">
      <h2>Money in</h2>

      {loading && <p className="hint">Consulting the ledger…</p>}

      {!loading && income.length === 0 && (
        <p className="hint">Nothing earned yet — the scout is looking.</p>
      )}

      {income.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Entry</th>
              <th>Category</th>
              <th>Paid via</th>
              <th className="right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {income.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="entry">{entry.description}</span>
                  <span className="date">
                    {entry.source ? `${entry.source} · ` : ''}
                    {formatDate(entry.received_at)}
                  </span>
                </td>
                <td>
                  <span className="badge">{entry.category}</span>
                </td>
                <td>
                  <span className={`badge payout ${entry.payout_method.toLowerCase().replace(/\s+/g, '-')}`}>
                    {entry.payout_method}
                  </span>
                  <span className={entry.status === 'confirmed' ? 'badge confirmed' : 'badge pending'}>
                    {entry.status}
                  </span>
                </td>
                <td className="right amount income-amount">{formatAmount(entry.amount)}</td>
                <td className="right">
                  <button
                    type="button"
                    className="ghost"
                    aria-label={`Delete ${entry.description}`}
                    onClick={() => handleDelete(entry.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
