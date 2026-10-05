import type { Schedule, SpeechEvent } from './events.ts'
import type { Token, UnitToken } from './tokens.ts'
import type { VoiceInput } from './voice.ts'

import { shapeMelody } from './melody.ts'
import { createRandom, hashString } from './random.ts'
import { revealTimes, voiceClock, voiceSlot } from './timeline.ts'
import { resolveVoice } from './voice.ts'

/**
 * Turns analyzed tokens into timed, pitched events.
 *
 * The text and the voice run on separate clocks, as in the game: the dialogue box types at
 * `textRate`, and the voice says at most `speed` units per second, skipping what it cannot
 * keep up with (see `voiceClock`). The melody comes from `shapeMelody`. `voice` may be
 * partial, e.g. `{ preset: 'cranky' }`; a full `VoiceOptions` works too.
 */
export function schedule(tokens: readonly Token[], voice: VoiceInput = {}): Schedule {
  const options = resolveVoice(voice)
  const random = createRandom(options.seed ?? hashString(tokens.map(token => token.text).join('')))
  const reveal = revealTimes(tokens, options, random)
  const onsets = voiceClock(tokens, reveal, options.speed)
  const notes = shapeMelody(tokens, new Set(onsets.keys()), options, random)

  const events: SpeechEvent[] = tokens.map((_, index) => ({ type: 'mark', time: reveal[index]!, token: index }))
  let duration = reveal.at(-1) ?? 0
  const voiced = [...onsets.keys()]
  voiced.forEach((index, position) => {
    const token = tokens[index] as UnitToken
    const time = onsets.get(index)!
    const slot = voiceSlot(token, options.speed)
    const next = voiced[position + 1]
    const nextTime = next === undefined ? undefined : onsets.get(next)!
    // A unit followed by a pause may ring a little longer; otherwise it stops before the next one.
    const beforePause = nextTime === undefined || nextTime - time > slot * 1.6
    const maxDuration = beforePause ? slot * 1.6 : Math.min(slot * (1 + options.sustain), nextTime - time)
    const note = notes.get(index)!
    events.push({
      type: 'unit',
      unit: token.unit,
      time,
      hz: options.baseHz * 2 ** (note.semitones / 12),
      glide: options.glide * (0.6 + 0.8 * random()),
      gain: note.gain,
      maxDuration,
      token: index,
    })
    duration = Math.max(duration, time + maxDuration)
  })

  // Marks before units at the same instant, so the text never lags the sound.
  events.sort((a, b) => a.time - b.time || (a.type === b.type ? 0 : a.type === 'mark' ? -1 : 1))
  return { events, duration }
}
