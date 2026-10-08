// Thin wrapper over the browser's own speech engine: nothing to install, no keys.
// Listening needs the Web Speech API (Chrome, Edge, Safari); speaking needs
// speechSynthesis and works in most modern browsers.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

export const canListen = Boolean(Recognition)

export const canSpeak = 'speechSynthesis' in window

export function speak(text) {
  if (!canSpeak || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.02
  utterance.pitch = 1
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}

export function listen({ onTranscript, onEnd, onError }) {
  if (!Recognition) return null
  const recognition = new Recognition()
  recognition.lang = navigator.language || 'en-US'
  recognition.interimResults = true
  recognition.continuous = false

  recognition.onresult = (event) => {
    let interim = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const phrase = result[0].transcript.trim()
      if (result.isFinal && phrase) onTranscript(phrase, true)
      else interim += ` ${phrase}`
    }
    if (interim.trim()) onTranscript(interim.trim(), false)
  }
  recognition.onerror = (event) => onError?.(event.error)
  recognition.onend = () => onEnd?.()

  try {
    recognition.start()
  } catch (err) {
    onError?.(err.name || 'start-failed')
    return null
  }
  return recognition
}
