import type { SpeechEvent, Token, UnitEvent, VoiceInput } from '../src/index.ts'

import { describe, expect, it } from 'vitest'

import { compareEvents, createScheduler, schedule } from '../src/index.ts'
import { pause, sentence } from './helpers.ts'

const text: Token[] = [...sentence, pause('question', 9), ...sentence.map((token, index) => ({ ...token, start: index + 10, end: index + 11 })), pause('exclaim', 19)]

function inChunks(tokens: Token[], sizes: number[], voice: VoiceInput = {}): SpeechEvent[] {
  const scheduler = createScheduler(voice, { seed: 7 })
  const events: SpeechEvent[] = []
  let at = 0
  for (const size of sizes) {
    events.push(...scheduler.push(tokens.slice(at, at + size)))
    at += size
  }
  events.push(...scheduler.push(tokens.slice(at)), ...scheduler.end())
  return events.sort(compareEvents)
}

describe('createScheduler', () => {
  it('gives the same events however the input is split', () => {
    const whole = inChunks(text, [])
    expect(inChunks(text, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toEqual(whole)
    expect(inChunks(text, [3, 7, 2, 5])).toEqual(whole)
  })

  it('never produces an event before its horizon', () => {
    const scheduler = createScheduler({}, { seed: 7 })
    let horizon = 0
    for (const token of text) {
      for (const event of scheduler.push([token]))
        expect(event.time).toBeGreaterThanOrEqual(horizon - 1e-9)
      expect(scheduler.horizon).toBeGreaterThanOrEqual(horizon)
      horizon = scheduler.horizon
    }
    for (const event of scheduler.end())
      expect(event.time).toBeGreaterThanOrEqual(horizon - 1e-9)
    expect(scheduler.horizon).toBe(Infinity)
  })

  it('holds the last units of a sentence until it ends', () => {
    const scheduler = createScheduler({ textRate: 5, speed: 9 }, { seed: 7 })
    const units = scheduler.push(sentence).filter(event => event.type === 'unit')
    // The tail waits for the ending, which decides whether it rises.
    expect(units.length).toBeLessThan(sentence.length)
    const rest = scheduler.push([pause('question', 9)]).filter(event => event.type === 'unit')
    expect(units.length + rest.length).toBe(sentence.length)
  })

  it('flushes a quiet sentence as if a full stop was typed', () => {
    const scheduler = createScheduler({ textRate: 5, speed: 9 }, { seed: 7 })
    const pushed = scheduler.push(sentence.slice(0, 3)).filter(event => event.type === 'unit')
    const flushed = scheduler.flush().filter(event => event.type === 'unit')
    expect(pushed.length + flushed.length).toBe(3)
    // The horizon moves past the ringing of the last unit, so a player can finish it.
    const last = flushed.at(-1) as UnitEvent
    expect(scheduler.horizon).toBeGreaterThanOrEqual(last.time + last.maxDuration)
    // Later text starts a new sentence.
    expect(scheduler.push(sentence.slice(3, 5)).length).toBeGreaterThan(0)
  })

  it('reads a voice function before each step', () => {
    let baseHz = 200
    const scheduler = createScheduler(() => ({ baseHz, textRate: 5, speed: 9, liveliness: 0, declination: 0 }), { seed: 7 })
    scheduler.push(sentence.slice(0, 5))
    baseHz = 400
    const units = [...scheduler.push(sentence.slice(5)), ...scheduler.end()].filter(event => event.type === 'unit')
    // Units take the voice of the moment they are voiced, so the change starts with unit 5.
    const pitch = (token: number) => units.find(event => event.token === token)?.hz
    expect(pitch(4)).toBeCloseTo(200, 6)
    expect(pitch(8)).toBeCloseTo(400, 6)
  })

  it('rejects pushes after the end', () => {
    const scheduler = createScheduler()
    scheduler.end()
    expect(() => scheduler.push(sentence)).toThrow(/end/)
  })
})

describe('schedule', () => {
  it('matches a scheduler fed in one call', () => {
    expect(schedule(text, { seed: 7 }).events).toEqual(inChunks(text, []))
  })
})
