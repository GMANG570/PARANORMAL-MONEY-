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

export const uploadReceipt = (id, file) => {
  const body = new FormData()
  body.append('file', file)
  return request(`/api/transactions/${id}/receipt`, { method: 'POST', body })
}

export const receiptUrl = (id) => `/api/transactions/${id}/receipt`

export const listIncome = () => request('/api/income')

export const createIncome = (payload) =>
  request('/api/income', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })

export const deleteIncome = (id) => request(`/api/income/${id}`, { method: 'DELETE' })

export const listOpportunities = (payout = 'btc-paypal', minFloor = null) => {
  const params = new URLSearchParams({ payout })
  if (minFloor) params.set('min_floor', String(minFloor))
  return request(`/api/opportunities?${params.toString()}`)
}

export const updateOpportunity = (id, status) =>
  request(`/api/opportunities/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  })

export const getAgentStatus = () => request('/api/agent/status')

export const runAgentScan = () => request('/api/agent/scan', { method: 'POST' })

export const getPageView = (id) => request(`/api/opportunities/${id}/screen`)

export const followPageLink = (id, index) =>
  request(`/api/opportunities/${id}/screen/follow`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ index }),
  })

export const sendVoiceCommand = (phrase) =>
  request('/api/voice/command', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ phrase }),
  })
