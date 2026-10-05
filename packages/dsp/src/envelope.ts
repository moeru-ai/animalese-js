export function rms(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples)
    sum += sample * sample
  return samples.length ? Math.sqrt(sum / samples.length) : 0
}

export function peak(samples: Float32Array): number {
  let max = 0
  for (const sample of samples)
    max = Math.max(max, Math.abs(sample))
  return max
}

export const dbToGain = (db: number): number => 10 ** (db / 20)

export interface TrimOptions {
  /** Frames quieter than this (relative to the loudest frame) count as silence. */
  thresholdDb?: number
  /** Silence kept before the onset and after the offset. */
  paddingMs?: number
}

/** Cuts leading and trailing silence, measured over 5 ms frames. */
export function trimSilence(samples: Float32Array, sampleRate: number, options: TrimOptions = {}): Float32Array {
  const { thresholdDb = -40, paddingMs = 5 } = options
  const frame = Math.max(1, Math.round(sampleRate * 0.005))
  const levels: number[] = []
  for (let start = 0; start < samples.length; start += frame)
    levels.push(rms(samples.subarray(start, start + frame)))
  const threshold = Math.max(...levels, 0) * dbToGain(thresholdDb)
  const first = levels.findIndex(level => level > threshold)
  if (first < 0)
    return samples.slice(0, 0)
  const last = levels.findLastIndex(level => level > threshold)
  const padding = Math.round(sampleRate * paddingMs / 1000)
  return samples.slice(Math.max(0, first * frame - padding), Math.min(samples.length, (last + 1) * frame + padding))
}

/** Applies raised-cosine fades in place and returns the same array. */
export function applyFades(samples: Float32Array, sampleRate: number, fadeInMs: number, fadeOutMs: number): Float32Array {
  const fadeIn = Math.min(samples.length, Math.round(sampleRate * fadeInMs / 1000))
  const fadeOut = Math.min(samples.length, Math.round(sampleRate * fadeOutMs / 1000))
  for (let i = 0; i < fadeIn; i++)
    samples[i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / fadeIn)
  for (let i = 0; i < fadeOut; i++)
    samples[samples.length - 1 - i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / fadeOut)
  return samples
}

/** Scales to a target RMS level, backing off if that would push the peak above `peakDb`. */
export function normalizeLoudness(samples: Float32Array, targetDb = -18, peakDb = -1): Float32Array {
  const level = rms(samples)
  const top = peak(samples)
  if (level === 0 || top === 0)
    return samples
  const gain = Math.min(dbToGain(targetDb) / level, dbToGain(peakDb) / top)
  return samples.map(sample => sample * gain)
}
