import type { Onset } from './clocks.ts'
import type { UnitEvent } from './events.ts'
import type { Random } from './random.ts'
import type { PauseKind } from './tokens.ts'
import type { VoiceOptions } from './voice.ts'

import { voiceSlot } from './clocks.ts'
import { degreeToSemitones, scales } from './scales.ts'

/** Units at the end of a sentence that a question or exclamation bends. */
const tailLength = 3

interface Note {
  onset: Onset
  sentence: number
  /** Offset from `baseHz` before the sentence ending is known, in semitones. */
  semitones: number
  gain: number
  glide: number
  slot: number
  sustain: number
  baseHz: number
  questionRise: number
  exclaimLift: number
}

/**
 * Writes the melody one voiced unit at a time: a random walk on the scale that leans back
 * toward the centre, with a steady drop through each sentence.
 *
 * A question rises and an exclamation lifts over its last units, so the last units of a
 * sentence are held until the sentence closes. Every random choice happens when a unit is
 * added, which keeps the result independent of how the input was split.
 */
export class Melody {
  readonly #random: Random
  readonly #held: Note[] = []
  #sentence = -1
  #degree = 0
  #position = 0

  constructor(random: Random) {
    this.#random = random
  }

  /** Time of the earliest unit that is not final yet. */
  get earliest(): number | undefined {
    return this.#held[0]?.onset.time
  }

  /** Adds the next voiced unit and returns the units that became final. */
  add(onset: Onset, sentence: number, voice: VoiceOptions): UnitEvent[] {
    if (sentence !== this.#sentence) {
      this.#sentence = sentence
      this.#degree = 0
      this.#position = 0
    }
    if (this.#random() < voice.liveliness) {
      const step = this.#random() < 0.75 ? 1 : 2
      const up = this.#random() < 0.5 - this.#degree / (2 * Math.max(1, voice.range) + 1)
      this.#degree = Math.max(-voice.range, Math.min(voice.range, this.#degree + (up ? step : -step)))
    }
    const drop = voice.declination * Math.max(-0.5, 0.5 - this.#position / 8)
    this.#position++
    this.#held.push({
      onset,
      sentence,
      semitones: degreeToSemitones(scales[voice.scale], this.#degree) + drop,
      gain: voice.volume * (0.85 + 0.15 * this.#random()),
      glide: voice.glide * (0.6 + 0.8 * this.#random()),
      slot: voiceSlot(onset.token, voice.speed),
      sustain: voice.sustain,
      baseHz: voice.baseHz,
      questionRise: voice.questionRise,
      exclaimLift: voice.exclaimLift,
    })

    // A unit with enough later units in its sentence cannot be in the tail.
    const done: UnitEvent[] = []
    while (this.#held.length > tailLength && this.#held[tailLength]!.sentence === this.#held[0]!.sentence)
      done.push(this.#finish(this.#held.shift()!, this.#held[0], 0))
    return done
  }

  /**
   * Every unit of `sentence` is known: bend its tail by `ending` and finish it. Sentences
   * must be closed in order.
   */
  close(sentence: number, ending: PauseKind | undefined): UnitEvent[] {
    const count = this.#held.findIndex(note => note.sentence !== sentence)
    const notes = this.#held.splice(0, count === -1 ? this.#held.length : count)
    return notes.map((note, index) => {
      const fromEnd = notes.length - index
      const rank = Math.min(tailLength, notes.length) - fromEnd + 1
      const share = rank > 0 ? rank / Math.min(tailLength, notes.length) : 0
      const lift = ending === 'question' ? note.questionRise * share : ending === 'exclaim' ? note.exclaimLift * share : 0
      return this.#finish(note, notes[index + 1], lift, ending === 'exclaim' && share > 0 ? 1.15 : 1)
    })
  }

  #finish(note: Note, next: Note | undefined, lift: number, boost = 1): UnitEvent {
    // A unit before a pause may ring a little longer; otherwise it stops before the next one.
    const maxDuration = next === undefined
      ? note.slot * 1.6
      : Math.min(note.slot * (1 + note.sustain), next.onset.time - note.onset.time)
    return {
      type: 'unit',
      unit: note.onset.token.unit,
      time: note.onset.time,
      hz: note.baseHz * 2 ** ((note.semitones + lift) / 12),
      glide: note.glide,
      gain: Math.min(1, note.gain * boost),
      maxDuration,
      token: note.onset.index,
    }
  }
}
