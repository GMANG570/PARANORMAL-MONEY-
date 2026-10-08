import { receiptUrl } from '../api.js'
import { formatAmount, formatDate } from '../format.js'

export default function TransactionList({ transactions, onDelete, onError, loading }) {
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
      <h2>Ledger</h2>

      {loading && <p className="hint">Consulting the ledger…</p>}

      {!loading && transactions.length === 0 && (
        <p className="hint">Nothing spent yet. Impressive restraint.</p>
      )}

      {transactions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Entry</th>
              <th>Category</th>
              <th className="right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="entry">{entry.description}</span>
                  <span className="date">{formatDate(entry.created_at)}</span>
                  {entry.receipt_name && (
                    <a
                      className="receipt-link"
                      href={receiptUrl(entry.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Receipt
                    </a>
                  )}
                </td>
                <td>
                  <span className="badge">{entry.category}</span>
                </td>
                <td className="right amount">{formatAmount(entry.amount)}</td>
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
