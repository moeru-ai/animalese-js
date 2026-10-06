import type { Schedule, UnitEvent } from '@animalese/core'

export interface UnitSource {
  samples: Float32Array
  sampleRate: number
  /** Pitch every voiced unit of the bank was tuned to. */
  referenceHz: number
}

/** Finds the audio for a unit id, or `undefined` to leave it silent. */
export type UnitResolver = (unit: string) => UnitSource | undefined

const releaseSeconds = 0.012

/**
 * Soft limiter for overlapping units: leaves samples below 0.8 alone and bends louder ones
 * smoothly toward 1. It works sample by sample, so chunked and whole renders match.
 */
export function softClip(sample: number): number {
  const magnitude = Math.abs(sample)
  if (magnitude <= 0.8)
    return sample
  return Math.sign(sample) * (0.8 + 0.2 * Math.tanh((magnitude - 0.8) / 0.2))
}

/** Mixes unit events into audio a piece at a time. */
export interface Renderer {
  /** Adds a unit. It must not start before `position`. `source` defaults to the resolver's answer. */
  add: (event: UnitEvent, source?: UnitSource) => void
  /** Returns the mixed samples from `position` up to `until` seconds, and moves `position` there. */
  take: (until: number) => Float32Array
  /** Seconds already returned by `take`. */
  readonly position: number
  readonly sampleRate: number
}

/**
 * Mixes events without Web Audio, so it works in browsers, workers and Node. Playback-rate
 * pitching (target Hz over the bank's reference), an exponential glide across the unit,
 * per-unit gain and a short release when a unit is cut at `maxDuration`.
 */
export function createRenderer(resolve: UnitResolver = () => undefined, sampleRate = 44100): Renderer {
  // `pending[i]` is the sample at `cursor + i`.
  let pending = new Float32Array(sampleRate)
  let cursor = 0

  const reserve = (length: number): void => {
    if (length <= pending.length)
      return
    const grown = new Float32Array(Math.max(length, pending.length * 2))
    grown.set(pending)
    pending = grown
  }

  return {
    sampleRate,
    get position() {
      return cursor / sampleRate
    },
    add(event, source = resolve(event.unit)) {
      if (!source)
        return
      const offset = Math.round(event.time * sampleRate) - cursor
      if (offset < 0)
        throw new RangeError(`unit at ${event.time}s starts before the render position ${cursor / sampleRate}s`)
      const step = (event.hz / source.referenceHz) * source.sampleRate / sampleRate
      const cut = Math.round(event.maxDuration * sampleRate)
      const release = Math.round(releaseSeconds * sampleRate)
      reserve(offset + cut + release)
      let position = 0
      for (let i = 0; i < cut + release; i++) {
        const index = Math.floor(position)
        if (index + 1 >= source.samples.length)
          break
        const fraction = position - index
        const sample = source.samples[index]! + fraction * (source.samples[index + 1]! - source.samples[index]!)
        const envelope = i < cut ? 1 : 1 - (i - cut) / release
        pending[offset + i]! += sample * event.gain * envelope
        position += step * 2 ** (event.glide / 12 * Math.min(1, i / cut))
      }
    },
    take(until) {
      const count = Math.max(0, Math.round(until * sampleRate) - cursor)
      reserve(count)
      const output = pending.slice(0, count).map(softClip)
      pending.copyWithin(0, count)
      pending.fill(0, pending.length - count)
      cursor += count
      return output
    },
  }
}

/** Mixes a whole schedule into one mono buffer. */
export function renderSchedule({ events, duration }: Schedule, resolve: UnitResolver, sampleRate = 44100): Float32Array {
  const renderer = createRenderer(resolve, sampleRate)
  for (const event of events) {
    if (event.type === 'unit')
      renderer.add(event)
  }
  return renderer.take(duration + releaseSeconds)
}
