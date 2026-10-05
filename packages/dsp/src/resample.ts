const taps = 16

function sinc(x: number): number {
  if (x === 0)
    return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

/**
 * Reads `input` at `factor` times normal speed with a Lanczos-windowed sinc kernel,
 * like a tape or sampler: factor 2 is one octave up and half as long.
 * When speeding up, the kernel is widened to low-pass below the new Nyquist and avoid aliasing.
 */
export function resample(input: Float32Array, factor: number): Float32Array {
  if (factor <= 0)
    throw new RangeError('factor must be positive')
  const output = new Float32Array(Math.max(0, Math.floor(input.length / factor)))
  const cutoff = Math.min(1, 1 / factor)
  const radius = Math.ceil(taps / cutoff)

  for (let i = 0; i < output.length; i++) {
    const position = i * factor
    const center = Math.floor(position)
    let sum = 0
    let weight = 0
    for (let j = center - radius + 1; j <= center + radius; j++) {
      if (j < 0 || j >= input.length)
        continue
      const distance = (position - j) * cutoff
      if (Math.abs(distance) >= taps)
        continue
      const w = sinc(distance) * sinc(distance / taps)
      sum += input[j]! * w
      weight += w
    }
    output[i] = weight > 0 ? sum / weight : 0
  }
  return output
}

/** Converts to another sample rate without changing pitch or duration. */
export function convertSampleRate(input: Float32Array, from: number, to: number): Float32Array {
  return from === to ? input : resample(input, from / to)
}
