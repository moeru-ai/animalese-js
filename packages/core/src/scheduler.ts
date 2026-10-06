import type { Schedule, SpeechEvent } from './events.ts'
import type { PauseKind, Token } from './tokens.ts'
import type { VoiceInput, VoiceOptions } from './voice.ts'

import { TextClock, VoiceClock } from './clocks.ts'
import { Melody } from './melody.ts'
import { createRandom, hashString } from './random.ts'
import { resolveVoice } from './voice.ts'

/**
 * Voice settings, or a function that returns them. A function is read again before each
 * step, so a signal (for example an alien-signals `computed`) can change the voice while
 * it speaks.
 */
export type VoiceSource = VoiceInput | (() => VoiceInput)

export interface Scheduler {
  /** Adds tokens and returns the events that became final. */
  push: (tokens: readonly Token[]) => SpeechEvent[]
  /** Ends the current sentence as if a full stop had been typed, for live input that went quiet. */
  flush: () => SpeechEvent[]
  /** No more tokens will come: returns every remaining event. */
  end: () => SpeechEvent[]
  /** No event that is still to come starts before this time. */
  readonly horizon: number
  /** Seconds until the last final unit stops ringing, or the last token appears. */
  readonly duration: number
  /** Every token pushed so far; events refer to them by index. */
  readonly tokens: readonly Token[]
}

const sentenceEnds = new Set<PauseKind>(['period', 'question', 'exclaim', 'ellipsis', 'newline'])

/**
 * Turns tokens into timed, pitched events as they arrive.
 *
 * The text and the voice run on separate clocks, as in the game: the dialogue box types at
 * `textRate`, and the voice says at most `speed` units per second, skipping what it cannot
 * keep up with. The melody follows each sentence and bends its tail for questions and
 * exclamations. The events do not depend on how the tokens were split into calls.
 */
export function createScheduler(voice: VoiceSource = {}, options: { seed?: number } = {}): Scheduler {
  const tokens: Token[] = []
  const read = (): VoiceOptions => resolveVoice(typeof voice === 'function' ? voice() : voice)
  const voiceClock = new VoiceClock()
  let textClock: TextClock | undefined
  let melody: Melody | undefined

  // Sentence of each unit token, and the ending of each sentence once it is typed.
  const sentenceOf = new Map<number, number>()
  const endings = new Map<number, PauseKind>()
  let sentence = 0
  let sentenceHasUnits = false
  let closed = 0
  let duration = 0
  let ended = false

  const start = (text: string): void => {
    if (textClock)
      return
    const seed = options.seed ?? read().seed ?? hashString(text)
    textClock = new TextClock(createRandom(seed))
    melody = new Melody(createRandom(seed ^ 0x9E3779B9))
  }

  const finish = (events: SpeechEvent[], final: boolean): SpeechEvent[] => {
    const current = read()
    // The next unit cannot appear before the text clock's current time.
    for (const onset of voiceClock.resolve(current.speed, final ? Infinity : textClock!.time))
      events.push(...melody!.add(onset, sentenceOf.get(onset.index)!, current))
    // A sentence is complete once it has ended and the voice has decided all of its units.
    const waiting = voiceClock.waiting
    while (closed <= sentence) {
      const open = closed === sentence && !endings.has(closed)
      if (open && (!final || !sentenceHasUnits))
        break
      if (waiting !== undefined && sentenceOf.get(waiting)! <= closed)
        break
      events.push(...melody!.close(closed, endings.get(closed)))
      closed++
    }
    for (const event of events) {
      if (event.type === 'unit')
        duration = Math.max(duration, event.time + event.maxDuration)
    }
    return events
  }

  const push = (batch: readonly Token[]): SpeechEvent[] => {
    if (ended)
      throw new Error('cannot push after end()')
    if (batch.length === 0)
      return []
    start(batch.map(token => token.text).join(''))
    const events: SpeechEvent[] = []
    for (const token of batch) {
      const index = tokens.push(token) - 1
      const current = read()
      const time = textClock!.reveal(token, current)
      duration = Math.max(duration, time)
      events.push({ type: 'mark', time, token: index })
      if (token.kind === 'unit') {
        if (endings.has(sentence)) {
          sentence++
          sentenceHasUnits = false
        }
        sentenceHasUnits = true
        sentenceOf.set(index, sentence)
        voiceClock.add(index, token, time)
      }
      else if (token.kind === 'pause' && sentenceEnds.has(token.pause) && sentenceHasUnits && endings.get(sentence) !== 'question') {
        // Keep the strongest ending so "?!" still rises.
        endings.set(sentence, token.pause)
      }
    }
    return finish(events, false)
  }

  const flush = (): SpeechEvent[] => {
    if (!textClock || ended)
      return []
    if (sentenceHasUnits && !endings.has(sentence))
      endings.set(sentence, 'period')
    textClock.wait(read().pauses.period)
    const events = finish([], true)
    if (endings.has(sentence)) {
      sentence++
      sentenceHasUnits = false
    }
    return events
  }

  const end = (): SpeechEvent[] => {
    if (ended)
      return []
    const events = textClock ? finish([], true) : []
    ended = true
    return events
  }

  return {
    push,
    flush,
    end,
    tokens,
    get duration() {
      return duration
    },
    get horizon() {
      if (ended)
        return Infinity
      if (!textClock)
        return 0
      const waiting = voiceClock.waiting === undefined ? Infinity : voiceClock.nextTick()
      return Math.min(textClock.time, waiting, melody!.earliest ?? Infinity)
    },
  }
}

/** Marks before units at the same instant, so the text never lags the sound. */
export function compareEvents(a: SpeechEvent, b: SpeechEvent): number {
  return a.time - b.time || (a.type === b.type ? a.token - b.token : a.type === 'mark' ? -1 : 1)
}

/** Schedules a whole text at once. `voice` may be partial, for example `{ preset: 'cranky' }`. */
export function schedule(tokens: readonly Token[], voice: VoiceSource = {}): Schedule {
  const scheduler = createScheduler(voice)
  const events = [...scheduler.push(tokens), ...scheduler.end()].sort(compareEvents)
  return { events, duration: scheduler.duration }
}
