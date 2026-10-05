export interface PitchOptions {
  minHz?: number
  maxHz?: number
  /** YIN absolute threshold; lower is stricter about calling a frame voiced. */
  threshold?: number
}

export interface PitchFrame {
  /** Frame center, in samples. */
  position: number
  /** Estimated f0 in Hz, or `null` when the frame is unvoiced. */
  hz: number | null
  rms: number
}

/**
 * Frame-by-frame f0 with the YIN algorithm (de Cheveigné & Kawahara, 2002):
 * cumulative-mean-normalized difference, absolute threshold, parabolic interpolation.
 */
export function trackPitch(samples: Float32Array, sampleRate: number, options: PitchOptions = {}): PitchFrame[] {
  const { minHz = 60, maxHz = 800, threshold = 0.15 } = options
  const maxLag = Math.ceil(sampleRate / minHz)
  const minLag = Math.floor(sampleRate / maxHz)
  const window = maxLag * 2
  const hop = Math.round(sampleRate * 0.01)
  const difference = new Float32Array(maxLag + 1)
  const frames: PitchFrame[] = []

  for (let start = 0; start + window <= samples.length; start += hop) {
    let energy = 0
    for (let i = start; i < start + window; i++)
      energy += samples[i]! ** 2
    const rms = Math.sqrt(energy / window)

    difference[0] = 1
    let runningSum = 0
    let lag = -1
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0
      for (let i = 0; i < maxLag; i++) {
        const delta = samples[start + i]! - samples[start + i + tau]!
        sum += delta * delta
      }
      runningSum += sum
      difference[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1
    }
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (difference[tau]! < threshold) {
        while (tau + 1 <= maxLag && difference[tau + 1]! < difference[tau]!)
          tau++
        lag = tau
        break
      }
    }

    let hz: number | null = null
    if (lag > 0) {
      const before = difference[lag - 1] ?? difference[lag]!
      const after = difference[lag + 1] ?? difference[lag]!
      const denominator = before + after - 2 * difference[lag]!
      const refined = denominator !== 0 ? lag + (before - after) / (2 * denominator) : lag
      hz = sampleRate / refined
    }
    frames.push({ position: start + window / 2, hz, rms })
  }
  return frames
}

/**
 * One representative f0 for a short recording: the energy-weighted median of voiced frames.
 * Returns `null` when too little of it is voiced (e.g. a lone "s").
 */
export function estimatePitch(samples: Float32Array, sampleRate: number, options: PitchOptions = {}): number | null {
  const frames = trackPitch(samples, sampleRate, options)
  const loudest = Math.max(0, ...frames.map(frame => frame.rms))
  const voiced = frames.filter(frame => frame.hz !== null && frame.rms > loudest * 0.2)
  if (voiced.length < 3)
    return null
  voiced.sort((a, b) => a.hz! - b.hz!)
  const total = voiced.reduce((sum, frame) => sum + frame.rms, 0)
  let accumulated = 0
  for (const frame of voiced) {
    accumulated += frame.rms
    if (accumulated >= total / 2)
      return frame.hz
  }
  return voiced.at(-1)!.hz
}

/** Nearest equal-tempered note frequency (A4 = 440 Hz). */
export function snapToSemitone(hz: number): number {
  return 440 * 2 ** (Math.round(12 * Math.log2(hz / 440)) / 12)
}
