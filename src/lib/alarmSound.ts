// src/lib/alarmSound.ts
// Akustischer Alarm OHNE Audio-Datei: ein durchdringender Zweiton (Sirene) über
// die Web Audio API. Browser erlauben Audio erst nach einer Nutzergeste – darum
// unlockAlarm() einmal beim Setzen des Ankers aufrufen (Button-Klick).

let ctx: AudioContext | null = null
let osc: OscillatorNode | null = null
let gain: GainNode | null = null
let lfo: OscillatorNode | null = null
let lfoGain: GainNode | null = null

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

/** Audio-Kontext per Nutzergeste aufwecken (sonst bleibt der Alarm stumm). */
export function unlockAlarm(): void {
  const c = ensureCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => undefined)
}

export function startAlarm(): void {
  const c = ensureCtx()
  if (!c || osc) return
  if (c.state === 'suspended') c.resume().catch(() => undefined)

  osc = c.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 700

  gain = c.createGain()
  gain.gain.value = 0.18 // konstant hörbar; das „nee-naw" macht die Frequenz

  // Langsamer Rechteck-LFO moduliert die Tonhöhe → Sirene 400/1000 Hz, ~3 Hz.
  lfo = c.createOscillator()
  lfo.type = 'square'
  lfo.frequency.value = 3
  lfoGain = c.createGain()
  lfoGain.gain.value = 300
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)

  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  lfo.start()
}

export function stopAlarm(): void {
  try {
    osc?.stop()
    lfo?.stop()
  } catch {
    // bereits gestoppt – egal
  }
  osc?.disconnect()
  gain?.disconnect()
  lfo?.disconnect()
  lfoGain?.disconnect()
  osc = null
  gain = null
  lfo = null
  lfoGain = null
}
