import { describe, expect, it } from 'vitest'

import { createRandom, degreeToSemitones, hashString, scales, semitonesToRate } from '../src/index.ts'

describe('scales', () => {
  it('maps degrees across octaves', () => {
    const pentatonic = scales['major-pentatonic']
    expect(degreeToSemitones(pentatonic, 0)).toBe(0)
    expect(degreeToSemitones(pentatonic, 5)).toBe(12)
    expect(degreeToSemitones(pentatonic, -1)).toBe(-3)
  })

  it('converts semitones to playback rates', () => {
    expect(semitonesToRate(12)).toBe(2)
    expect(semitonesToRate(-12)).toBe(0.5)
  })
})

describe('random', () => {
  it('repeats for the same seed and stays in [0, 1)', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    for (let i = 0; i < 100; i++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('hashes text stably', () => {
    expect(hashString('你好')).toBe(hashString('你好'))
    expect(hashString('你好')).not.toBe(hashString('您好'))
  })
})
