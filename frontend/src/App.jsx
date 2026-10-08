import { useCallback, useEffect, useState } from 'react'

import TransactionForm from './components/TransactionForm.jsx'
import TransactionList from './components/TransactionList.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import MonthlyChart from './components/MonthlyChart.jsx'
import {
  createTransaction,
  deleteTransaction,
  getMonthlySummary,
  getSummary,
  listTransactions,
} from './api.js'
import './styles.css'

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [months, setMonths] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [entries, totals, monthly] = await Promise.all([
        listTransactions(),
        getSummary(),
        getMonthlySummary(),
      ])
      setTransactions(entries)
      setSummary(totals)
      setMonths(monthly)
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

      <MonthlyChart months={months} loading={loading} />

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
