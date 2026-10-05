import type { Schedule, SpeechEvent, UnitEvent } from '@animalese/core'

import type { BankSet } from './bank.ts'

import { unitLanguage } from '@animalese/core'
import { encodeWav } from '@animalese/dsp'

const releaseSeconds = 0.012

function scheduleUnit(context: BaseAudioContext, banks: BankSet, event: UnitEvent, at: number, destination: AudioNode): AudioScheduledSourceNode | undefined {
  const bank = banks[unitLanguage(event.unit)]
  const unit = bank?.manifest.units[event.unit]
  if (!bank || !unit)
    return undefined

  const start = at + event.time
  const cut = start + event.maxDuration
  const rate = event.hz / bank.manifest.referenceHz

  const source = context.createBufferSource()
  source.buffer = bank.buffer
  source.playbackRate.setValueAtTime(rate, start)
  source.playbackRate.exponentialRampToValueAtTime(rate * 2 ** (event.glide / 12), cut)

  const gain = context.createGain()
  gain.gain.setValueAtTime(event.gain, start)
  gain.gain.setValueAtTime(event.gain, cut)
  gain.gain.linearRampToValueAtTime(0, cut + releaseSeconds)
  source.connect(gain).connect(destination)

  source.start(start, unit.offset / bank.manifest.sampleRate, unit.length / bank.manifest.sampleRate)
  source.stop(cut + releaseSeconds)
  return source
}

export interface PlayOptions {
  /** Defaults to `context.destination`. */
  destination?: AudioNode
  /** Called as each event's time is reached, e.g. to reveal text in sync. */
  onEvent?: (event: SpeechEvent) => void
}

export interface Playback {
  stop: () => void
  /** Resolves when playback ends or is stopped. */
  finished: Promise<void>
}

/** Plays a schedule in real time. Every unit is scheduled up front on the audio clock. */
export function play(context: AudioContext, banks: BankSet, plan: Schedule, options: PlayOptions = {}): Playback {
  const destination = options.destination ?? context.destination
  // A little headroom so the first unit is not late on a busy main thread.
  const at = context.currentTime + 0.05
  const sources = plan.events.flatMap(event => event.type === 'unit' ? scheduleUnit(context, banks, event, at, destination) ?? [] : [])

  let next = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let resolve!: () => void
  const finished = new Promise<void>((done) => {
    resolve = done
  })
  const stop = (): void => {
    clearInterval(timer)
    for (const source of sources) {
      try {
        source.stop()
      }
      catch {}
    }
    resolve()
  }
  timer = setInterval(() => {
    const elapsed = context.currentTime - at
    while (next < plan.events.length && plan.events[next]!.time <= elapsed) {
      // Advance outside the optional call: `f?.(x++)` skips `x++` when `f` is undefined.
      const event = plan.events[next++]!
      options.onEvent?.(event)
    }
    if (elapsed >= plan.duration + releaseSeconds)
      stop()
  }, 10)
  return { stop, finished }
}

/** Renders a schedule offline into mono samples. */
export async function render(banks: BankSet, plan: Schedule, sampleRate = 44100): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, Math.ceil((plan.duration + 0.1) * sampleRate), sampleRate)
  for (const event of plan.events) {
    if (event.type === 'unit')
      scheduleUnit(context, banks, event, 0, context.destination)
  }
  return (await context.startRendering()).getChannelData(0)
}

/** Renders a schedule offline into a 16-bit mono WAV file. */
export async function renderWav(banks: BankSet, plan: Schedule, sampleRate = 44100): Promise<Blob> {
  const wav = encodeWav({ samples: await render(banks, plan, sampleRate), sampleRate })
  return new Blob([wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' })
}
