let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

type Note = { freq: number; start: number; duration: number; gain?: number }

function playNotes(notes: Note[]) {
  const c = getCtx()
  if (!c) return
  const now = c.currentTime

  for (const n of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()

    osc.type = 'sine'
    osc.frequency.value = n.freq

    const peak = n.gain ?? 0.25
    gain.gain.setValueAtTime(0, now + n.start)
    gain.gain.linearRampToValueAtTime(peak, now + n.start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.duration)

    osc.connect(gain)
    gain.connect(c.destination)

    osc.start(now + n.start)
    osc.stop(now + n.start + n.duration + 0.02)
  }
}

export function playSaleSuccess() {
  playNotes([
    { freq: 1046.5, start: 0, duration: 0.14, gain: 0.22 },
    { freq: 1318.51, start: 0.08, duration: 0.14, gain: 0.22 },
    { freq: 1567.98, start: 0.16, duration: 0.32, gain: 0.28 },
  ])
}
