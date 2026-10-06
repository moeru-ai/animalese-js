import type { Random } from './random.ts'
import type { Token, UnitToken } from './tokens.ts'
import type { VoiceOptions } from './voice.ts'

import { languagePacing } from './pacing.ts'
import { tokenLanguage } from './tokens.ts'

/** Seconds one voiced unit occupies on the voice clock. */
export function voiceSlot(token: UnitToken, speed: number): number {
  return 1 / (speed * languagePacing[tokenLanguage(token)].voice)
}

/**
 * The dialogue box: reveals tokens one after another at `textRate` (scaled per language)
 * and pauses at punctuation. Tokens spelled from one character, like an English digit,
 * appear together.
 */
export class TextClock {
  /** When the next token will appear. */
  time = 0
  #lastPause = 0
  #lastStart = -1
  #lastReveal = 0
  readonly #random: Random

  constructor(random: Random) {
    this.#random = random
  }

  /** Reveals `token` and returns when it appears. */
  reveal(token: Token, voice: VoiceOptions): number {
    if (token.start === this.#lastStart)
      return this.#lastReveal
    this.#lastStart = token.start
    const at = this.time
    if (token.kind === 'pause') {
      // Runs like "?!" or "……" pause for the longest member, not the sum.
      const pause = voice.pauses[token.pause]
      this.time += Math.max(0, pause - this.#lastPause)
      this.#lastPause = Math.max(this.#lastPause, pause)
    }
    else if (token.kind === 'unit') {
      this.#lastPause = 0
      const beats = token.text.length / languagePacing[tokenLanguage(token)].charsPerBeat
      this.time += beats * (1 + (this.#random() - 0.5) * 2 * voice.timingJitter) / voice.textRate
    }
    this.#lastReveal = at
    return at
  }

  /** Waits, as if a pause had been typed. */
  wait(seconds: number): void {
    this.time += Math.max(0, seconds - this.#lastPause)
    this.#lastPause = Math.max(this.#lastPause, seconds)
  }
}

interface Pending {
  index: number
  reveal: number
  token: UnitToken
}

export interface Onset {
  index: number
  time: number
  token: UnitToken
}

/**
 * The voice: ticks at most `speed` times a second (scaled per language) and on each tick
 * says the latest unit revealed since the previous tick. Units typed faster than that are
 * skipped, and weak ones (的/了/吗, "the") give way to a stronger unit in the same tick.
 * When the text is slower than the voice, every unit is said the moment it appears.
 *
 * A tick is decided only once a later unit has appeared, so the same text gives the same
 * result however it is split into calls.
 */
export class VoiceClock {
  #tick = -Infinity
  readonly #pending: Pending[] = []

  add(index: number, token: UnitToken, reveal: number): void {
    this.#pending.push({ index, reveal, token })
  }

  /** Lowest token index still waiting for a tick, or `undefined`. */
  get waiting(): number | undefined {
    return this.#pending[0]?.index
  }

  /** The earliest time the next onset can have. */
  nextTick(): number {
    return Math.max(this.#tick, this.#pending[0]?.reveal ?? -Infinity)
  }

  /**
   * Decides every tick that can be decided. `nextReveal` is the earliest time a unit that
   * is not added yet can appear: `Infinity` once no more units will come.
   */
  resolve(speed: number, nextReveal: number): Onset[] {
    const onsets: Onset[] = []
    while (this.#pending.length > 0) {
      const tick = Math.max(this.#tick, this.#pending[0]!.reveal)
      const count = this.#pending.findIndex(item => item.reveal > tick + 1e-9)
      // Every pending unit is due at this tick, and a unit still to come could join it.
      if (count === -1 && nextReveal <= tick + 1e-9)
        break
      const due = this.#pending.splice(0, count === -1 ? this.#pending.length : count)
      const strong = due.filter(item => !item.token.weak)
      const chosen = (strong.length > 0 ? strong : due).at(-1)!
      onsets.push({ index: chosen.index, time: tick, token: chosen.token })
      this.#tick = tick + voiceSlot(chosen.token, speed)
    }
    return onsets
  }
}
