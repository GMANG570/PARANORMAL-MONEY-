const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function request(path, options) {
  const response = await fetch(path, options)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

export const listTransactions = () => request('/api/transactions')

export const getSummary = () => request('/api/summary')

export const createTransaction = (payload) =>
  request('/api/transactions', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })

export const deleteTransaction = (id) =>
  request(`/api/transactions/${id}`, { method: 'DELETE' })
