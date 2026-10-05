import { describe, expect, it } from 'vitest'

import { decodeWav, encodeWav, estimatePitch, flattenPitch, measureUnit, packSprite, prepareUnit, renderSchedule, resample, rms, sliceUnit, snapToSemitone, trimConsonant, trimSilence } from '../src/index.ts'

const rate = 24000
function sine(hz: number, seconds: number, amplitude = 0.5): Float32Array {
  return Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / rate))
}
function padded(samples: Float32Array, silence: number): Float32Array {
  const out = new Float32Array(samples.length + silence * 2)
  out.set(samples, silence)
  return out
}

describe('wav', () => {
  it('round-trips 16-bit PCM', () => {
    const samples = sine(440, 0.1)
    const decoded = decodeWav(encodeWav({ samples, sampleRate: rate }))
    expect(decoded.sampleRate).toBe(rate)
    expect(decoded.samples.length).toBe(samples.length)
    expect(Math.max(...decoded.samples.map((value, i) => Math.abs(value - samples[i]!)))).toBeLessThan(1e-4)
  })
})

describe('pitch', () => {
  it.each([110, 196, 330])('estimates a %d Hz sine', (hz) => {
    expect(estimatePitch(sine(hz, 0.3), rate)).toBeCloseTo(hz, -0.5)
  })

  it('returns null for noise', () => {
    let seed = 1
    const noise = Float32Array.from({ length: rate * 0.3 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5))
    expect(estimatePitch(noise, rate)).toBeNull()
  })

  it('snaps to the nearest semitone', () => {
    expect(snapToSemitone(225)).toBeCloseTo(220, 6)
    expect(snapToSemitone(450)).toBeCloseTo(440, 6)
  })
})

describe('resample', () => {
  it('raises pitch and shortens the sound by the factor', () => {
    const out = resample(sine(200, 0.4), 1.5)
    expect(out.length).toBe(Math.floor(rate * 0.4 / 1.5))
    expect(estimatePitch(out, rate)).toBeCloseTo(300, -0.5)
  })
})

describe('prepare', () => {
  it('trims silence', () => {
    const trimmed = trimSilence(padded(sine(200, 0.2), rate * 0.2), rate, { paddingMs: 0 })
    expect(trimmed.length / rate).toBeCloseTo(0.2, 1)
  })

  it('keeps only a short consonant before voicing starts', () => {
    // 200 ms of noise ("s") followed by a 220 Hz vowel.
    let seed = 7
    const noise = Float32Array.from({ length: rate * 0.2 }, () => 0.3 * ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5))
    const syllable = new Float32Array(noise.length + rate * 0.3)
    syllable.set(noise)
    syllable.set(sine(220, 0.3), noise.length)
    const trimmed = trimConsonant(syllable, rate, 220, 30)
    // About 30 ms of consonant remain, give or take one analysis frame.
    expect((trimmed.length - rate * 0.3) / rate).toBeCloseTo(0.03, 1)
  })

  it('flattens a pitch glide without changing the length', () => {
    // A vowel-like tone gliding from 180 Hz to 260 Hz, with a few harmonics.
    const length = rate * 0.4
    let phase = 0
    const glide = Float32Array.from({ length }, (_, i) => {
      phase += 2 * Math.PI * (180 + 80 * i / length) / rate
      return 0.4 * Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase)
    })
    const flat = flattenPitch(glide, rate, 220)
    expect(flat.length).toBe(glide.length)
    expect(estimatePitch(flat.subarray(0, rate * 0.1), rate)).toBeCloseTo(220, -1)
    expect(estimatePitch(flat.subarray(rate * 0.3, rate * 0.4), rate)).toBeCloseTo(220, -1)
  })

  it('retunes a unit to the reference pitch, caps its length and levels it', () => {
    const measured = measureUnit(padded(sine(180, 0.5), rate * 0.1), rate)
    expect(measured.f0).toBeCloseTo(180, -0.5)
    const prepared = prepareUnit(measured, rate, { referenceHz: 220, maxMs: 200, loudnessDb: -18 })
    expect(prepared.samples.length).toBe(rate * 0.2)
    expect(estimatePitch(prepared.samples.subarray(0, rate * 0.15), rate)).toBeCloseTo(220, -0.5)
    expect(20 * Math.log10(rms(prepared.samples))).toBeCloseTo(-18, 0)
  })
})

describe('sprite and render', () => {
  it('packs units and renders a schedule from them', () => {
    const sprite = packSprite([{ id: 'zh/a', samples: sine(220, 0.3), f0: 220 }, { id: 'zh/o', samples: sine(330, 0.1), f0: 330 }], rate)
    expect(sliceUnit(sprite.samples, sprite.units['zh/o']!).length).toBe(rate * 0.1)
    const output = renderSchedule({
      events: [
        { type: 'unit', unit: 'zh/a', time: 0, hz: 440, glide: 0, gain: 1, maxDuration: 1, token: 0 },
        { type: 'unit', unit: 'zh/o', time: 0.2, hz: 220, glide: 0, gain: 1, maxDuration: 0.02, token: 1 },
      ],
      duration: 0.3,
    }, unit => ({ samples: sliceUnit(sprite.samples, sprite.units[unit]!), sampleRate: rate, referenceHz: 220 }), rate)
    // With the bank tuned to 220 Hz, asking for 440 Hz plays the first unit an octave up;
    // the second is cut after 20 ms plus a short release.
    expect(estimatePitch(output.subarray(0, rate * 0.14), rate)).toBeCloseTo(440, -1)
    expect(rms(output.subarray(rate * 0.25, rate * 0.3))).toBe(0)
  })
})

describe('glide', () => {
  it('bends pitch across the unit', () => {
    const output = renderSchedule({
      events: [{ type: 'unit', unit: 'zh/a', time: 0, hz: 220, glide: -12, gain: 1, maxDuration: 0.4, token: 0 }],
      duration: 0.4,
    }, () => ({ samples: sine(220, 2), sampleRate: rate, referenceHz: 220 }), rate)
    expect(estimatePitch(output.subarray(0, rate * 0.06), rate)).toBeGreaterThan(200)
    expect(estimatePitch(output.subarray(rate * 0.34, rate * 0.4), rate)).toBeLessThan(130)
  })
})
