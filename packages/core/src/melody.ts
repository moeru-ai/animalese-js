import type { Random } from './random.ts'
import type { PauseKind, Token } from './tokens.ts'
import type { VoiceOptions } from './voice.ts'

import { degreeToSemitones, scales } from './scales.ts'

export interface Note {
  /** Offset from `baseHz`, in semitones. */
  semitones: number
  gain: number
}

const sentenceEnds = new Set<PauseKind>(['period', 'question', 'exclaim', 'ellipsis', 'newline'])

interface Sentence {
  units: number[]
  ending?: PauseKind
}

/** Groups voiced token indices into sentences, remembering how each one ends. */
function sentences(tokens: readonly Token[], voiced: ReadonlySet<number>): Sentence[] {
  const result: Sentence[] = [{ units: [] }]
  tokens.forEach((token, index) => {
    const current = result.at(-1)!
    if (voiced.has(index)) {
      if (current.ending)
        result.push({ units: [index] })
      else
        current.units.push(index)
    }
    else if (token.kind === 'pause' && sentenceEnds.has(token.pause) && current.units.length > 0 && current.ending !== 'question') {
      // Keep the strongest ending so "?!" still rises.
      current.ending = token.pause
    }
  })
  return result.filter(sentence => sentence.units.length > 0)
}

/**
 * Writes the melody for the voiced units: a random walk on `scale` that leans back toward
 * the centre, plus sentence declination, a rise over the end of a question and a lift for
 * exclamations.
 */
export function shapeMelody(tokens: readonly Token[], voiced: ReadonlySet<number>, voice: VoiceOptions, random: Random): Map<number, Note> {
  const scale = scales[voice.scale]
  const notes = new Map<number, Note>()
  for (const { units, ending } of sentences(tokens, voiced)) {
    const tail = Math.min(3, units.length)
    let degree = 0
    units.forEach((index, position) => {
      if (random() < voice.liveliness) {
        const step = random() < 0.75 ? 1 : 2
        const up = random() < 0.5 - degree / (2 * Math.max(1, voice.range) + 1)
        degree = Math.max(-voice.range, Math.min(voice.range, degree + (up ? step : -step)))
      }
      const progress = units.length > 1 ? position / (units.length - 1) : 0
      let semitones = degreeToSemitones(scale, degree) + voice.declination * (0.5 - progress)
      let gain = voice.volume * (0.85 + 0.15 * random())
      if (ending === 'question' && position >= units.length - tail)
        semitones += voice.questionRise * (position - (units.length - tail) + 1) / tail
      if (ending === 'exclaim') {
        semitones += voice.exclaimLift
        gain *= 1.15
      }
      notes.set(index, { semitones, gain: Math.min(1, gain) })
    })
  }
  return notes
}
