import { useCallback, useEffect, useState } from 'react'

import TransactionForm from './components/TransactionForm.jsx'
import TransactionList from './components/TransactionList.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import {
  createTransaction,
  deleteTransaction,
  getSummary,
  listTransactions,
} from './api.js'
import './styles.css'

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [entries, totals] = await Promise.all([listTransactions(), getSummary()])
      setTransactions(entries)
      setSummary(totals)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async (payload) => {
    await createTransaction(payload)
    await refresh()
  }

  const handleDelete = async (id) => {
    await deleteTransaction(id)
    await refresh()
  }

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">Ledger of the unexplained</p>
        <h1>Paranormal Money</h1>
        <p className="tagline">
          Every séance, salt line and spirit fee — tracked to the cent.
        </p>
      </header>

      {error && <p className="error">The ledger resisted: {error}</p>}

      <SummaryCards summary={summary} />

      <div className="columns">
        <TransactionForm onSubmit={handleCreate} onError={setError} />
        <TransactionList
          transactions={transactions}
          onDelete={handleDelete}
          onError={setError}
          loading={loading}
        />
      </div>
    </div>
  )
}
