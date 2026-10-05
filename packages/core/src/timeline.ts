import type { Random } from './random.ts'
import type { Token, UnitToken } from './tokens.ts'
import type { VoiceOptions } from './voice.ts'

import { languagePacing } from './pacing.ts'
import { tokenLanguage } from './tokens.ts'

/**
 * When each token appears in the dialogue box: typed at `textRate` (scaled per language),
 * pausing at punctuation. Tokens spelled from one character, like an English digit, appear
 * together.
 */
export function revealTimes(tokens: readonly Token[], voice: Pick<VoiceOptions, 'textRate' | 'timingJitter' | 'pauses'>, random: Random): number[] {
  const times: number[] = []
  let time = 0
  let lastPause = 0
  let lastStart = -1
  for (const token of tokens) {
    if (token.start === lastStart) {
      times.push(times.at(-1)!)
      continue
    }
    lastStart = token.start
    times.push(time)
    if (token.kind === 'pause') {
      // Runs like "?!" or "……" pause for the longest member, not the sum.
      const pause = voice.pauses[token.pause]
      time += Math.max(0, pause - lastPause)
      lastPause = Math.max(lastPause, pause)
    }
    else if (token.kind === 'unit') {
      lastPause = 0
      const beats = token.text.length / languagePacing[tokenLanguage(token)].charsPerBeat
      time += beats * (1 + (random() - 0.5) * 2 * voice.timingJitter) / voice.textRate
    }
  }
  return times
}

/** Seconds one voiced unit occupies on the voice clock. */
export function voiceSlot(token: UnitToken, speed: number): number {
  return 1 / (speed * languagePacing[tokenLanguage(token)].voice)
}

/**
 * Runs the voice clock: it ticks at most `speed` times a second (scaled per language) and on
 * each tick says the latest character revealed since the previous tick. Characters typed
 * faster than that are skipped, and weak ones (的/了/吗, "the") give way to a stronger
 * neighbour revealed in the same tick. When the text is slower than the voice, every
 * character is said the moment it appears.
 *
 * Returns the voice onset of each voiced token index, in token order.
 */
export function voiceClock(tokens: readonly Token[], reveal: readonly number[], speed: number): Map<number, number> {
  const units = tokens.flatMap((token, index) => token.kind === 'unit' ? [index] : [])
  const voiced = new Map<number, number>()
  let tick = -Infinity
  let next = 0
  while (next < units.length) {
    // Wait for the next character if the text has fallen behind the voice.
    tick = Math.max(tick, reveal[units[next]!]!)
    const pending: number[] = []
    while (next < units.length && reveal[units[next]!]! <= tick + 1e-9)
      pending.push(units[next++]!)
    const strong = pending.filter(index => !(tokens[index] as UnitToken).weak)
    const chosen = (strong.length ? strong : pending).at(-1)!
    voiced.set(chosen, tick)
    tick += voiceSlot(tokens[chosen] as UnitToken, speed)
  }
  return voiced
}
