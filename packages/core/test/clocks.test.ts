import type { Token, UnitToken } from '../src/index.ts'

import { describe, expect, it } from 'vitest'

import { createRandom, resolveVoice, TextClock, VoiceClock } from '../src/index.ts'
import { pause, sentence, unit } from './helpers.ts'

const steady = resolveVoice({ textRate: 10, timingJitter: 0 })

function reveal(tokens: Token[]): number[] {
  const clock = new TextClock(createRandom(1))
  return tokens.map(token => clock.reveal(token, steady))
}

function voiced(tokens: Token[], times: number[], speed: number): number[] {
  const clock = new VoiceClock()
  tokens.forEach((token, index) => clock.add(index, token as UnitToken, times[index]!))
  return clock.resolve(speed, Infinity).map(onset => onset.index)
}

describe('textClock', () => {
  it('types one Chinese character per beat', () => {
    expect(reveal(sentence.slice(0, 4))).toEqual([0, 0.1, 0.2, expect.closeTo(0.3, 9)])
  })

  it('pauses at punctuation, taking the longest of a run', () => {
    const times = reveal([unit('a', 0), pause('question', 1), pause('period', 2), unit('a', 3)])
    expect(times[3]).toBeCloseTo(0.1 + Math.max(steady.pauses.question, steady.pauses.period), 9)
  })

  it('types English several letters per beat', () => {
    const english: Token = { kind: 'unit', unit: 'ja/pa', language: 'en', text: 'past', start: 0, end: 4 }
    expect(reveal([english, { ...english, start: 4, end: 8 }])[1]).toBeLessThan(0.4 / 2)
  })

  it('reveals tokens spelled from one character together', () => {
    const digit = { kind: 'unit', unit: 'ja/se', language: 'en', text: '7', start: 0, end: 1 } as const
    expect(reveal([digit, { ...digit, unit: 'ja/bu' }])).toEqual([0, 0])
  })
})

describe('voiceClock', () => {
  it('voices every unit when the text is slower than the voice', () => {
    expect(voiced(sentence, sentence.map((_, index) => index * 0.2), 8)).toEqual(sentence.map((_, index) => index))
  })

  it('keeps its own pace and says the latest unit when the text is faster', () => {
    expect(voiced(sentence, sentence.map((_, index) => index * 0.05), 10)).toEqual([0, 2, 4, 6, 8])
  })

  it('lets weak units give way', () => {
    const tokens = [unit('wo', 0), unit('chi', 1), unit('le', 2, { weak: true }), unit('fan', 3)]
    expect(voiced(tokens, [0, 0.05, 0.1, 0.15], 10)).toEqual([0, 1, 3])
  })

  it('still voices a weak unit when nothing stronger is due', () => {
    expect(voiced([unit('hao', 0), unit('de', 1, { weak: true })], [0, 0.5], 10)).toEqual([0, 1])
  })

  it('waits while a later unit could still join the tick', () => {
    const clock = new VoiceClock()
    clock.add(0, unit('a', 0) as UnitToken, 0)
    expect(clock.resolve(10, 0)).toEqual([])
    // Once the text has moved past the tick, nothing can join it.
    expect(clock.resolve(10, 0.05).map(onset => onset.index)).toEqual([0])
  })
})
