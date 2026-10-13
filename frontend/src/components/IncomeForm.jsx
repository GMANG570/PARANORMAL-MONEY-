import { useState } from 'react'

import { INCOME_CATEGORIES, PAYOUT_METHODS } from '../format.js'

export default function IncomeForm({ onSubmit, onError }) {
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [category, setCategory] = useState(INCOME_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState(PAYOUT_METHODS[0])
  const [status, setStatus] = useState('pending')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        description: description.trim(),
        source: source.trim(),
        category,
        amount: Number(amount),
        payout_method: payoutMethod,
        status,
      })
      setDescription('')
      setSource('')
      setAmount('')
      setCategory(INCOME_CATEGORIES[0])
      setPayoutMethod(PAYOUT_METHODS[0])
      setStatus('pending')
      onError('')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Log money in</h2>

      <label>
        What paid
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Bounty payout"
          required
        />
      </label>

      <label>
        Paid by
        <input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Who sent it"
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {INCOME_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Amount (USD)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          required
        />
      </label>

      <label>
        Paid via
        <select
          value={payoutMethod}
          onChange={(event) => setPayoutMethod(event.target.value)}
        >
          {PAYOUT_METHODS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </label>

      <button type="submit" disabled={saving}>
        {saving ? 'Recording…' : 'Record income'}
      </button>
    </form>
  )
}
