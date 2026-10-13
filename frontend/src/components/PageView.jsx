import { useCallback, useEffect, useState } from 'react'

import { followPageLink, getPageView } from '../api.js'

export default function PageView({ opportunity, onClose, onError }) {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (fetcher) => {
      setBusy(true)
      try {
        setPage(await fetcher())
        onError('')
      } catch (err) {
        onError(err.message)
      } finally {
        setBusy(false)
        setLoading(false)
      }
    },
    [onError],
  )

  useEffect(() => {
    load(() => getPageView(opportunity.id))
  }, [load, opportunity.id])

  return (
    <div className="screen-view" role="dialog" aria-modal="true" aria-label="Screen view">
      <div className="screen-view-inner">
        <div className="panel-head">
          <h2>Screen view</h2>
          <div className="screen-view-actions">
            <a href={page?.url ?? opportunity.url} target="_blank" rel="noreferrer">
              Open in browser
            </a>
            <button type="button" className="chip" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <p className="hint">
          What the scout sees on that page, and every control it found there. It follows
          the page's own links; anything that would submit or change something on the
          site stays yours to click.
        </p>

        {loading && <p className="hint">The scout is reading the page…</p>}

        {!loading && page && (
          <>
            <p className="page-title">{page.title}</p>

            <h3>Links · {page.links.length}</h3>
            {page.links.length === 0 && <p className="hint">No links on this page.</p>}
            <ul className="controls">
              {page.links.map((item, index) => (
                <li key={item.url}>
                  <span className="badge">link</span>
                  <span className="control-label">{item.label}</span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => load(() => followPageLink(opportunity.id, index))}
                  >
                    Follow
                  </button>
                  <a className="ghost-link" href={item.url} target="_blank" rel="noreferrer">
                    ↗
                  </a>
                </li>
              ))}
            </ul>

            <h3>Buttons · {page.buttons.length}</h3>
            {page.buttons.length === 0 && <p className="hint">No buttons on this page.</p>}
            <ul className="controls">
              {page.buttons.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span className="badge">{item.kind}</span>
                  <span className="control-label">{item.label}</span>
                  <span className="hint">yours to click</span>
                </li>
              ))}
            </ul>

            <h3>Icons · {page.icons.length}</h3>
            {page.icons.length === 0 && <p className="hint">No icons on this page.</p>}
            <ul className="controls">
              {page.icons.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span className="control-label">{item.label}</span>
                  <span className="hint">yours to click</span>
                </li>
              ))}
            </ul>

            <h3>What the page says</h3>
            <p className="page-text">{page.text}</p>
          </>
        )}
      </div>
    </div>
  )
}
