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

export const getMonthlySummary = () => request('/api/summary/monthly')

export const createTransaction = (payload) =>
  request('/api/transactions', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })

export const deleteTransaction = (id) =>
  request(`/api/transactions/${id}`, { method: 'DELETE' })

export const listIncome = () => request('/api/income')

export const createIncome = (payload) =>
  request('/api/income', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })

export const deleteIncome = (id) => request(`/api/income/${id}`, { method: 'DELETE' })

export const listOpportunities = (payout = 'btc-paypal') =>
  request(`/api/opportunities?payout=${encodeURIComponent(payout)}`)

export const updateOpportunity = (id, status) =>
  request(`/api/opportunities/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  })

export const getAgentStatus = () => request('/api/agent/status')

export const runAgentScan = () => request('/api/agent/scan', { method: 'POST' })
