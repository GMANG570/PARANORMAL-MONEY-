import { useState } from 'react'

import { CATEGORIES } from '../format.js'

export default function TransactionForm({ onSubmit, onError }) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        description: description.trim(),
        category,
        amount: Number(amount),
      })
      setDescription('')
      setAmount('')
      setCategory(CATEGORIES[0])
      onError('')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Log a charge</h2>

      <label>
        What happened
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Salt circle top-up"
          required
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES.map((option) => (
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

      <button type="submit" disabled={saving}>
        {saving ? 'Recording…' : 'Record charge'}
      </button>
    </form>
  )
}
