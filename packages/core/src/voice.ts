import type { ScaleName } from './scales.ts'
import type { PauseKind } from './tokens.ts'

export interface VoiceOptions {
  /**
   * Speaking pitch in Hz. Measured on ACNH recordings: a cranky villager sits near 115 Hz,
   * others at 330–500 Hz, so this is absolute rather than "an octave up".
   */
  baseHz: number
  /** Chinese characters revealed per second (the dialogue box typing speed). Other languages scale it, see `languagePacing`. */
  textRate: number
  /** Most units the voice says per second. When the text is faster, the voice keeps its own pace and skips characters. */
  speed: number
  /** Melody notes are snapped to this scale, like running the voice through an auto-tuner. */
  scale: ScaleName
  /** How far the melody may wander from the base pitch, in scale degrees each way. */
  range: number
  /** 0 keeps a monotone; 1 moves on almost every unit. */
  liveliness: number
  /** Pitch drop across a sentence, in semitones. */
  declination: number
  /** Rise over the last units of a question, in semitones. */
  questionRise: number
  /** Extra pitch for exclamations, in semitones. */
  exclaimLift: number
  /** Pitch bend inside each unit, in semitones; recordings show a short fall at the end of most units. */
  glide: number
  /** Random variation of the typing speed, as a fraction of a character's time. */
  timingJitter: number
  /** How long a unit rings relative to the voice slot (1 / speed); negative leaves a gap. */
  sustain: number
  volume: number
  /** Pause lengths in seconds. */
  pauses: Record<PauseKind, number>
  /** Seed for the melody; by default derived from the text so a line always sounds the same. */
  seed?: number
}

export type VoicePreset = 'normal' | 'peppy' | 'cranky' | 'lazy' | 'snooty' | 'jock' | 'smug' | 'sisterly'

/** Partial voice options, optionally starting from a preset. */
export type VoiceInput = Partial<Omit<VoiceOptions, 'pauses'>> & {
  preset?: VoicePreset
  pauses?: Partial<Record<PauseKind, number>>
}

export const defaultVoice: Readonly<VoiceOptions> = {
  baseHz: 400,
  textRate: 12,
  speed: 8.5,
  scale: 'major-pentatonic',
  range: 2,
  liveliness: 0.45,
  declination: 2,
  questionRise: 4,
  exclaimLift: 2,
  glide: -1.2,
  timingJitter: 0.1,
  sustain: -0.1,
  volume: 0.9,
  pauses: {
    space: 0.04,
    comma: 0.22,
    period: 0.4,
    question: 0.4,
    exclaim: 0.34,
    ellipsis: 0.55,
    newline: 0.45,
    tie: 0.06,
  },
}

/**
 * Voice presets named after the villager personalities whose banks ACNH ships.
 * Measured on recordings: cranky 罗博 ~115 Hz, smug Marshal ~330 Hz, lazy Derwin ~445 Hz,
 * others 400–500 Hz. One villager per personality is thin evidence (pitch varies by villager,
 * not only by personality); the remaining presets are guesses.
 */
export const voicePresets: Readonly<Record<VoicePreset, Readonly<Partial<VoiceOptions>>>> = {
  normal: {},
  peppy: { baseHz: 520, textRate: 14, speed: 10, range: 3, liveliness: 0.7, scale: 'major', exclaimLift: 3 },
  cranky: { baseHz: 115, textRate: 10, speed: 6, range: 2, liveliness: 0.35, scale: 'minor-pentatonic', declination: 3, glide: -0.6 },
  lazy: { baseHz: 440, textRate: 10, speed: 7.5, range: 1, liveliness: 0.25, timingJitter: 0.2 },
  snooty: { baseHz: 470, textRate: 12, speed: 8.5, range: 2, liveliness: 0.4, scale: 'minor' },
  jock: { baseHz: 220, textRate: 13, speed: 9, range: 2, liveliness: 0.55, exclaimLift: 4 },
  smug: { baseHz: 330, textRate: 11, speed: 8, range: 3, liveliness: 0.45, scale: 'whole-tone' },
  sisterly: { baseHz: 300, textRate: 12, speed: 8.5, range: 2, liveliness: 0.45, scale: 'minor-pentatonic' },
}

/** Fills in a full voice: defaults, then the preset, then the given overrides. */
export function resolveVoice(input: VoiceInput = {}): VoiceOptions {
  const { preset = 'normal', pauses, ...overrides } = input
  return {
    ...defaultVoice,
    ...voicePresets[preset],
    ...overrides,
    pauses: { ...defaultVoice.pauses, ...pauses },
  }
}
