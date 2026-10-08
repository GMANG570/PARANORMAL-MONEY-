import { useCallback, useEffect, useState } from 'react'

import TransactionForm from './components/TransactionForm.jsx'
import TransactionList from './components/TransactionList.jsx'
import IncomeForm from './components/IncomeForm.jsx'
import IncomeList from './components/IncomeList.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import MonthlyChart from './components/MonthlyChart.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import {
  createIncome,
  createTransaction,
  deleteIncome,
  deleteTransaction,
  getMonthlySummary,
  getSummary,
  listIncome,
  listTransactions,
  uploadReceipt,
} from './api.js'
import './styles.css'

export default function App() {
  const [transactions, setTransactions] = useState([])
  const [income, setIncome] = useState([])
  const [summary, setSummary] = useState(null)
  const [months, setMonths] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [entries, totals, monthly, earned] = await Promise.all([
        listTransactions(),
        getSummary(),
        getMonthlySummary(),
        listIncome(),
      ])
      setTransactions(entries)
      setSummary(totals)
      setMonths(monthly)
      setIncome(earned)
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

  const handleCreate = async (payload, receipt) => {
    const created = await createTransaction(payload)
    if (receipt) await uploadReceipt(created.id, receipt)
    await refresh()
  }

  const handleDelete = async (id) => {
    await deleteTransaction(id)
    await refresh()
  }

  const handleCreateIncome = async (payload) => {
    await createIncome(payload)
    await refresh()
  }

  const handleDeleteIncome = async (id) => {
    await deleteIncome(id)
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
        <IncomeForm onSubmit={handleCreateIncome} onError={setError} />
        <IncomeList
          income={income}
          onDelete={handleDeleteIncome}
          onError={setError}
          loading={loading}
        />
      </div>

      <div className="columns">
        <TransactionForm onSubmit={handleCreate} onError={setError} />
        <TransactionList
          transactions={transactions}
          onDelete={handleDelete}
          onError={setError}
          loading={loading}
        />
      </div>

      <AgentPanel onError={setError} />
    </div>
  )
}
