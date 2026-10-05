import type { Token } from '../src/index.ts'

import { describe, expect, it } from 'vitest'

import { createRandom, resolveVoice, revealTimes, voiceClock } from '../src/index.ts'
import { pause, sentence, unit } from './helpers.ts'

const steady = resolveVoice({ textRate: 10, timingJitter: 0 })

describe('revealTimes', () => {
  it('types one Chinese character per beat', () => {
    expect(revealTimes(sentence.slice(0, 4), steady, createRandom(1))).toEqual([0, 0.1, 0.2, expect.closeTo(0.3, 9)])
  })

  it('pauses at punctuation, taking the longest of a run', () => {
    const tokens = [unit('a', 0), pause('question', 1), pause('period', 2), unit('a', 3)]
    const times = revealTimes(tokens, steady, createRandom(1))
    expect(times[3]).toBeCloseTo(0.1 + Math.max(steady.pauses.question, steady.pauses.period), 9)
  })

  it('types English several letters per beat', () => {
    const english: Token = { kind: 'unit', unit: 'ja/pa', language: 'en', text: 'past', start: 0, end: 4 }
    const times = revealTimes([english, { ...english, start: 4, end: 8 }], steady, createRandom(1))
    expect(times[1]).toBeLessThan(0.4 / 2)
  })

  it('reveals tokens spelled from one character together', () => {
    const digit = { kind: 'unit', unit: 'ja/se', language: 'en', text: '7', start: 0, end: 1 } as const
    expect(revealTimes([digit, { ...digit, unit: 'ja/bu' }], steady, createRandom(1))).toEqual([0, 0])
  })
})

describe('voiceClock', () => {
  it('voices every character when the text is slower than the voice', () => {
    const reveal = sentence.map((_, index) => index * 0.2)
    expect([...voiceClock(sentence, reveal, 8).keys()]).toEqual(sentence.map((_, index) => index))
  })

  it('keeps its own pace and says the latest character when the text is faster', () => {
    // Two characters per tick.
    const reveal = sentence.map((_, index) => index * 0.05)
    const voiced = voiceClock(sentence, reveal, 10)
    expect([...voiced.keys()]).toEqual([0, 2, 4, 6, 8])
    expect([...voiced.values()]).toEqual([0, 0.1, 0.2, expect.closeTo(0.3, 9), expect.closeTo(0.4, 9)])
  })

  it('lets weak characters give way', () => {
    const tokens = [unit('wo', 0), unit('chi', 1), unit('le', 2, { weak: true }), unit('fan', 3)]
    const reveal = [0, 0.05, 0.1, 0.15]
    expect([...voiceClock(tokens, reveal, 10).keys()]).toEqual([0, 1, 3])
  })

  it('still voices a weak character when nothing stronger is pending', () => {
    const tokens = [unit('hao', 0), unit('de', 1, { weak: true })]
    expect([...voiceClock(tokens, [0, 0.5], 10).keys()]).toEqual([0, 1])
  })
})
