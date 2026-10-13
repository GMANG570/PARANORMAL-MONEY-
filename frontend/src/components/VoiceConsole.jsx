import { useEffect, useRef, useState } from 'react'

import { createIncome, createTransaction, runAgentScan, sendVoiceCommand } from '../api.js'
import { canListen, canSpeak, listen, speak, stopSpeaking } from '../speech.js'

const EXAMPLES = '“spent 25 on salt”, “received 300 for a bounty, confirmed”, “scan now”'

function scanLine(report) {
  const added = report?.added ?? 0
  const failed = report?.errors?.length ?? 0
  const found = `${added} new lead${added === 1 ? '' : 's'} on the board`
  return failed
    ? `Sweep finished: ${found}, though ${failed} source${failed === 1 ? '' : 's'} failed.`
    : `Sweep finished: ${found}.`
}

export default function VoiceConsole({ onRefresh, onAgentRefresh, onError }) {
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const recognition = useRef(null)

  useEffect(
    () => () => {
      recognition.current?.abort?.()
      stopSpeaking()
    },
    [],
  )

  const handlePhrase = async (phrase) => {
    setBusy(true)
    try {
      const command = await sendVoiceCommand(phrase)
      let spoken = command.reply

      if (command.intent === 'expense') {
        await createTransaction(command.payload)
        await onRefresh()
      }
      if (command.intent === 'income') {
        await createIncome(command.payload)
        await onRefresh()
      }
      if (command.intent === 'scan') {
        spoken = scanLine(await runAgentScan())
        onAgentRefresh()
      }

      setReply(spoken)
      speak(spoken)
      setNote('')
      onError('')
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleListening = () => {
    if (listening) {
      recognition.current?.stop()
      return
    }
    setHeard('')
    setNote('')
    const instance = listen({
      onTranscript: (transcript, final) => {
        setHeard(transcript)
        if (final) handlePhrase(transcript)
      },
      onEnd: () => setListening(false),
      onError: (code) =>
        setNote(
          code === 'not-allowed' || code === 'service-not-allowed'
            ? 'The microphone is blocked — allow it for this page and try again.'
            : `The microphone faltered (${code}). Try again.`,
        ),
    })
    if (!instance) {
      setNote('This browser cannot listen — Chrome, Edge or Safari can.')
      return
    }
    recognition.current = instance
    setListening(true)
  }

  return (
    <section className="panel voice">
      <div className="panel-head">
        <h2>Agent voice</h2>
        <button
          type="button"
          className={listening ? 'chip active' : 'chip'}
          onClick={toggleListening}
          disabled={!canListen || busy}
        >
          {listening ? 'Listening…' : busy ? 'Working…' : 'Talk to the agent'}
        </button>
      </div>

      <p className="hint">
        Say a whole entry or a command instead of typing — {EXAMPLES}. The agent logs it,
        sweeps the boards when asked, and answers out loud.
      </p>

      {!canListen && (
        <p className="hint">
          This browser has no speech recognition, so the microphone button stays off.
        </p>
      )}

      {note && <p className="hint voice-note">{note}</p>}

      <p className="voice-line">
        <span className="hint">You said</span> {heard || '—'}
      </p>
      <p className="voice-line">
        <span className="hint">Agent</span> <strong>{reply || '—'}</strong>
      </p>
      {!canSpeak && <p className="hint">This browser cannot talk back; replies stay in text.</p>}
    </section>
  )
}
