import { useCallback, useEffect, useState } from 'react'

import {
  getAgentStatus,
  listOpportunities,
  runAgentScan,
  updateOpportunity,
} from '../api.js'
import { formatDate } from '../format.js'

const FILTERS = [
  { id: 'btc-paypal', label: 'Bitcoin & PayPal' },
  { id: 'crypto', label: 'Crypto & tokens too' },
  { id: 'all', label: 'Everything found' },
]

function lastRunLine(status) {
  if (!status) return 'Checking on the scout…'
  const cadence = status.interval_seconds
    ? `every ${Math.round(status.interval_seconds / 3600)}h`
    : 'paused'
  if (status.last_run) {
    return `Last sweep ${new Date(status.last_run).toLocaleString()} · ${cadence}`
  }
  if (status.last_discovery) {
    return `Newest find ${new Date(status.last_discovery).toLocaleString()} · ${cadence}`
  }
  return `No sweep yet · ${cadence}`
}

export default function AgentPanel({ onError }) {
  const [status, setStatus] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [filter, setFilter] = useState('btc-paypal')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (which) => {
      try {
        const [agentStatus, found] = await Promise.all([
          getAgentStatus(),
          listOpportunities(which),
        ])
        setStatus(agentStatus)
        setOpportunities(found)
        onError('')
      } catch (err) {
        onError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [onError],
  )

  useEffect(() => {
    load(filter)
  }, [load, filter])

  const handleScan = async () => {
    setScanning(true)
    try {
      setStatus(await runAgentScan())
      setOpportunities(await listOpportunities(filter))
      onError('')
    } catch (err) {
      onError(err.message)
    } finally {
      setScanning(false)
    }
  }

  const setOpportunityStatus = async (id, value) => {
    try {
      await updateOpportunity(id, value)
      setOpportunities(await listOpportunities(filter))
      setStatus(await getAgentStatus())
      onError('')
    } catch (err) {
      onError(err.message)
    }
  }

  const stored = status?.stored ?? {}

  return (
    <section className="panel agent">
      <div className="panel-head">
        <h2>Scout agent</h2>
        <button type="button" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Sweeping…' : 'Scan now'}
        </button>
      </div>

      <p className="hint">{lastRunLine(status)}</p>
      <p className="hint">
        {stored.total ?? 0} kept · {stored.new ?? 0} new · {stored.shortlisted ?? 0} shortlisted
        {status?.last_error ? ` · one source failed: ${status.last_error}` : ''}
      </p>
      <p className="hint">
        The scout reads public listings only, and records what it finds. It never signs up,
        registers or logs in anywhere for you — you act on the shortlist yourself.
      </p>

      <div className="toolbar">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={filter === option.id ? 'chip active' : 'chip'}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <p className="hint">Waking the scout…</p>}

      {!loading && opportunities.length === 0 && (
        <p className="hint">
          Nothing on the board yet. Run a scan, or widen the filter to everything it found.
        </p>
      )}

      <ul className="opportunities">
        {opportunities.map((item) => (
          <li key={item.id}>
            <div className="opportunity-main">
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <p className="hint">
                {item.source} · {item.kind}
                {item.budget_text ? ` · ${item.budget_text}` : ''} · found{' '}
                {formatDate(item.discovered_at)}
              </p>
              {item.payout_text && <p className="hint payout-note">“{item.payout_text}”</p>}
            </div>

            <div className="opportunity-actions">
              <span
                className={`badge payout ${item.payout_method.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.payout_method}
              </span>
              {item.status === 'shortlisted' ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpportunityStatus(item.id, 'new')}
                >
                  Unshortlist
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpportunityStatus(item.id, 'shortlisted')}
                >
                  Shortlist
                </button>
              )}
              <button
                type="button"
                className="ghost"
                onClick={() => setOpportunityStatus(item.id, 'dismissed')}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
