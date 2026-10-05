import type { PitchOptions } from './pitch.ts'

import { trackPitch } from './pitch.ts'

/** f0 for every sample index, with unvoiced gaps bridged from their voiced neighbours. */
function pitchContour(samples: Float32Array, sampleRate: number, options: PitchOptions): { hz: Float32Array, voiced: Uint8Array } | null {
  const frames = trackPitch(samples, sampleRate, options)
  const loudest = Math.max(0, ...frames.map(frame => frame.rms))
  const points = frames.filter(frame => frame.hz !== null && frame.rms > loudest * 0.05)
  if (points.length < 2)
    return null

  // A three-point median removes isolated octave errors before interpolating.
  const smoothed = points.map((point, index) => {
    const window = [points[index - 1], point, points[index + 1]].flatMap(item => item?.hz ?? [])
    return { position: point.position, hz: window.toSorted((a, b) => a - b)[Math.floor(window.length / 2)]! }
  })

  const hz = new Float32Array(samples.length)
  const voiced = new Uint8Array(samples.length)
  const hop = Math.round(sampleRate * 0.01)
  let k = 0
  for (let i = 0; i < samples.length; i++) {
    while (k + 1 < smoothed.length && smoothed[k + 1]!.position <= i)
      k++
    const a = smoothed[k]!
    const b = smoothed[Math.min(k + 1, smoothed.length - 1)]!
    const t = b.position === a.position ? 0 : Math.min(1, Math.max(0, (i - a.position) / (b.position - a.position)))
    hz[i] = a.hz + t * (b.hz - a.hz)
    // A sample counts as voiced if a voiced frame centre lies within one hop of it.
    voiced[i] = Math.abs(i - a.position) <= hop * 1.5 || Math.abs(i - b.position) <= hop * 1.5 ? 1 : 0
  }
  return { hz, voiced }
}

/** Analysis marks one local period apart, each snapped to the nearest waveform peak. */
function analysisMarks(samples: Float32Array, sampleRate: number, hz: Float32Array, voiced: Uint8Array, fallbackPeriod: number): { at: number, period: number }[] {
  const marks: { at: number, period: number }[] = []
  let at = 0
  while (at < samples.length) {
    const period = voiced[at] ? sampleRate / hz[at]! : fallbackPeriod
    let best = at
    if (voiced[at]) {
      const radius = Math.floor(period * 0.3)
      for (let i = Math.max(0, at - radius); i <= Math.min(samples.length - 1, at + radius); i++) {
        if (samples[i]! > samples[best]!)
          best = i
      }
    }
    // Never step backwards, or marks pile up.
    const mark = Math.max(best, (marks.at(-1)?.at ?? -1) + 1)
    marks.push({ at: mark, period })
    at = Math.round(mark + period)
  }
  return marks
}

/**
 * Flattens the pitch of a recording to `targetHz` with TD-PSOLA, keeping its duration and
 * formants. This is the "pull every syllable flat, then quantize" step of the Animalese
 * recipe: tone contours from the recorded carrier disappear, and the timbre does not
 * turn into a chipmunk the way resampling would.
 *
 * Unvoiced stretches are re-synthesized at the same positions, so consonants pass through.
 * Returns the input unchanged when too little of it is voiced to track.
 */
export function flattenPitch(samples: Float32Array, sampleRate: number, targetHz: number, options: PitchOptions = {}): Float32Array {
  const contour = pitchContour(samples, sampleRate, { minHz: 60, maxHz: 900, ...options })
  if (!contour)
    return samples
  const targetPeriod = sampleRate / targetHz
  const marks = analysisMarks(samples, sampleRate, contour.hz, contour.voiced, targetPeriod)

  const output = new Float32Array(samples.length)
  const weights = new Float32Array(samples.length)
  let mark = 0
  for (let at = 0; at < samples.length;) {
    while (mark + 1 < marks.length && Math.abs(marks[mark + 1]!.at - at) <= Math.abs(marks[mark]!.at - at))
      mark++
    const source = marks[mark]!
    const voiced = contour.voiced[source.at] === 1
    // Voiced: lay grains at the target period. Unvoiced: copy grains in place.
    const center = voiced ? at : source.at
    const half = Math.round(source.period)
    for (let i = -half; i < half; i++) {
      const from = source.at + i
      const to = center + i
      if (from < 0 || from >= samples.length || to < 0 || to >= output.length)
        continue
      const window = 0.5 + 0.5 * Math.cos(Math.PI * i / half)
      output[to]! += samples[from]! * window
      weights[to]! += window
    }
    at = voiced ? Math.round(at + targetPeriod) : Math.max(at + 1, source.at + half)
  }
  for (let i = 0; i < output.length; i++)
    output[i] = weights[i]! > 0.1 ? output[i]! / weights[i]! : output[i]!
  return output
}
