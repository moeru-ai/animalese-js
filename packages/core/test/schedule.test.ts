import { describe, expect, it } from 'vitest'

import { degreeToSemitones, scales, schedule } from '../src/index.ts'
import { pause, semitones, sentence, unit, units } from './helpers.ts'

// Text slower than the voice: every character is voiced.
const relaxed = { textRate: 5, speed: 9, timingJitter: 0 }

describe('schedule', () => {
  it('is deterministic for the same text and voice', () => {
    expect(schedule(sentence)).toEqual(schedule(sentence))
  })

  it('changes the melody with the seed', () => {
    const melody = (seed: number) => units(schedule(sentence, { ...relaxed, seed, liveliness: 1 })).map(event => event.hz)
    expect(melody(1)).not.toEqual(melody(2))
  })

  it('accepts presets', () => {
    const hz = (preset: 'cranky' | 'peppy') => units(schedule(sentence, { preset, ...relaxed, liveliness: 0, declination: 0 }))[0]!.hz
    expect(hz('cranky')).toBeLessThan(hz('peppy'))
  })

  it('marks every token, voiced or not, in time order', () => {
    const plan = schedule(sentence, { textRate: 20, speed: 5 })
    const marks = plan.events.filter(event => event.type === 'mark')
    expect(marks.map(event => event.token)).toEqual(sentence.map((_, index) => index))
    expect(plan.events.map(event => event.time)).toEqual(plan.events.map(event => event.time).toSorted((a, b) => a - b))
  })

  it('reveals a voiced token no later than its sound', () => {
    const plan = schedule(sentence)
    for (const event of units(plan)) {
      const mark = plan.events.findIndex(other => other.type === 'mark' && other.token === event.token)
      expect(mark).toBeLessThan(plan.events.indexOf(event))
    }
  })

  it('pitches around baseHz and snaps the melody to the scale', () => {
    const allowed = new Set(Array.from({ length: 13 }, (_, i) => degreeToSemitones(scales['major-pentatonic'], i - 6)))
    for (const event of units(schedule(sentence, { ...relaxed, baseHz: 300, declination: 0, scale: 'major-pentatonic', range: 6, liveliness: 1 })))
      expect(allowed).toContain(Math.round(semitones(event.hz, 300) * 1e6) / 1e6)
  })

  it('raises the end of a question', () => {
    const plan = schedule([...sentence, pause('question', 9)], { ...relaxed, liveliness: 0, declination: 0, questionRise: 6 })
    const pitches = units(plan).map(event => event.hz)
    expect(semitones(pitches.at(-1)!, pitches[0]!)).toBeCloseTo(6, 6)
  })

  it('lifts and strengthens exclamations', () => {
    const flat = { ...relaxed, liveliness: 0, declination: 0, exclaimLift: 3 }
    const said = units(schedule([unit('a', 0), pause('period', 1)], flat))[0]!
    const shouted = units(schedule([unit('a', 0), pause('exclaim', 1)], flat))[0]!
    expect(semitones(shouted.hz, said.hz)).toBeCloseTo(3, 6)
  })

  it('cuts each unit before the next one starts', () => {
    const voiced = units(schedule(sentence, { textRate: 30, speed: 8 }))
    for (let i = 1; i < voiced.length; i++)
      expect(voiced[i - 1]!.time + voiced[i - 1]!.maxDuration).toBeLessThanOrEqual(voiced[i]!.time + 1e-9)
  })

  it('handles empty input', () => {
    expect(schedule([])).toEqual({ events: [], duration: 0 })
  })
})
