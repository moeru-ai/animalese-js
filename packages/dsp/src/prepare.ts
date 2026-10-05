import type { PitchOptions } from './pitch.ts'

import { applyFades, normalizeLoudness, trimSilence } from './envelope.ts'
import { estimatePitch, trackPitch } from './pitch.ts'
import { flattenPitch } from './psola.ts'

export interface PrepareOptions {
  /** Flatten voiced units to this pitch. Leave undefined to keep the recorded pitch. */
  referenceHz?: number
  /** Longest unit kept; the rest is faded out. Short units keep the babble crisp. */
  maxMs?: number
  /**
   * Longest consonant kept before voicing starts. ACNH units are almost all vowel;
   * a long "s" or "sh" onset would otherwise fill most of a 100 ms slot with noise.
   */
  leadMs?: number
  trimThresholdDb?: number
  loudnessDb?: number
  pitch?: PitchOptions
}

export interface PreparedUnit {
  samples: Float32Array
  /** f0 measured on the raw recording, before retuning. */
  f0: number | null
}

/** Measures a recording's pitch after trimming silence, so batch callers can choose a shared reference first. */
export function measureUnit(samples: Float32Array, sampleRate: number, options: PrepareOptions = {}): PreparedUnit {
  const trimmed = trimSilence(samples, sampleRate, { thresholdDb: options.trimThresholdDb })
  return { samples: trimmed, f0: estimatePitch(trimmed, sampleRate, options.pitch) }
}

/** Index of the first loud voiced frame, or 0 when the unit is unvoiced. */
export function voicingOnset(samples: Float32Array, sampleRate: number, options?: PitchOptions): number {
  const frames = trackPitch(samples, sampleRate, options)
  const loudest = Math.max(0, ...frames.map(frame => frame.rms))
  const first = frames.find(frame => frame.hz !== null && frame.rms > loudest * 0.2)
  // Frame positions are window centres; step back half a window to the frame start.
  return first ? Math.max(0, first.position - Math.round(sampleRate * 0.0125)) : 0
}

/** Pitch-tracking band around a unit's own f0; an open range lets YIN lock onto a harmonic. */
export function pitchBand(f0: number, options?: PitchOptions): PitchOptions {
  return { minHz: f0 / 1.8, maxHz: f0 * 1.8, ...options }
}

/** Keeps at most `leadMs` of consonant before voicing starts. Returns a view, not a copy. */
export function trimConsonant(samples: Float32Array, sampleRate: number, f0: number, leadMs = 30, options?: PitchOptions): Float32Array {
  const onset = voicingOnset(samples, sampleRate, pitchBand(f0, options))
  return samples.subarray(Math.max(0, onset - Math.round(sampleRate * leadMs / 1000)))
}

/**
 * The offline half of the "Animalese in a DAW" recipe, applied to one recorded unit:
 * shorten the consonant onset, flatten the pitch to a common reference note (TD-PSOLA, so
 * formants and length stay), cap the length, fade the edges and level it. Runtime playback
 * then only changes the playback rate.
 */
export function prepareUnit(measured: PreparedUnit, sampleRate: number, options: PrepareOptions = {}): PreparedUnit {
  const { referenceHz, maxMs = 260, leadMs = 30, loudnessDb = -18 } = options
  let samples = measured.samples
  if (measured.f0) {
    samples = trimConsonant(samples, sampleRate, measured.f0, leadMs, options.pitch)
    if (referenceHz)
      samples = flattenPitch(samples, sampleRate, referenceHz, pitchBand(measured.f0, options.pitch))
  }

  const maxLength = Math.round(sampleRate * maxMs / 1000)
  samples = samples.slice(0, Math.min(samples.length, maxLength))
  applyFades(samples, sampleRate, 3, Math.min(40, maxMs / 4))
  return { samples: normalizeLoudness(samples, loudnessDb), f0: measured.f0 }
}
