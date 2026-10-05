import type { Schedule } from '@animalese/core'

import { peak } from './envelope.ts'

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
 * Mixes a schedule into a mono buffer without Web Audio, for Node, workers and tests.
 * Mirrors what the Web Audio player does: playback-rate pitching (target Hz over the bank's
 * reference), an exponential glide across the unit, per-unit gain and a short release when
 * a unit is cut at `maxDuration`.
 */
export function renderSchedule(
  { events, duration }: Schedule,
  resolve: UnitResolver,
  sampleRate = 44100,
): Float32Array {
  const output = new Float32Array(Math.ceil((duration + releaseSeconds) * sampleRate))
  for (const event of events) {
    if (event.type !== 'unit')
      continue
    const source = resolve(event.unit)
    if (!source)
      continue
    const step = (event.hz / source.referenceHz) * source.sampleRate / sampleRate
    const start = Math.round(event.time * sampleRate)
    const cut = Math.round(event.maxDuration * sampleRate)
    const release = Math.round(releaseSeconds * sampleRate)
    let position = 0
    for (let i = 0; i < cut + release && start + i < output.length; i++) {
      const index = Math.floor(position)
      if (index + 1 >= source.samples.length)
        break
      const fraction = position - index
      const sample = source.samples[index]! + fraction * (source.samples[index + 1]! - source.samples[index]!)
      const envelope = i < cut ? 1 : 1 - (i - cut) / release
      output[start + i]! += sample * event.gain * envelope
      position += step * 2 ** (event.glide / 12 * Math.min(1, i / cut))
    }
  }

  // Soft-limit only if overlapping units actually clip.
  if (peak(output) > 1) {
    for (let i = 0; i < output.length; i++)
      output[i] = Math.tanh(output[i]!)
  }
  return output
}
