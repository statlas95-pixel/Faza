// Тактильный микрозвук (Web Audio API, 0 кБ, выкл. по умолчанию) + View Transitions API (Пакет T).
import { getProgress } from './store'

let audioCtx: AudioContext | null = null

export function playTactile(kind: 'tap' | 'flip' | 'ok' = 'tap') {
  try {
    if (!getProgress().settings.sound) return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    const startFreq = kind === 'ok' ? 680 : kind === 'flip' ? 520 : 600
    const endFreq = kind === 'ok' ? 960 : kind === 'flip' ? 740 : 720
    const dur = kind === 'ok' ? 0.055 : 0.022

    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur)
    gain.gain.setValueAtTime(0.028, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.005)
  } catch {
    // Беззвучный фолбэк в окружениях без Web Audio
  }
}

export function withViewTransition(fn: () => void) {
  const doc = document as any
  if (typeof doc?.startViewTransition === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    try {
      doc.startViewTransition(fn)
      return
    } catch {
      // fallback
    }
  }
  fn()
}
