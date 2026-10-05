import type { LanguageCode } from './tokens.ts'

export interface LanguagePacing {
  /** Source characters per text beat; `textRate` is beats per second. */
  charsPerBeat: number
  /** Voice speed multiplier on top of `speed`. */
  voice: number
}

/**
 * Pacing relative to Chinese, measured on ACNH recordings. Chinese: ~11–13 characters/s
 * against ~8–10 units/s. English: the box types ~45–70 letters/s and the voice says
 * ~13–14 units/s, about one per syllable. Japanese and Korean are not measured yet.
 */
export const languagePacing: Readonly<Record<LanguageCode, Readonly<LanguagePacing>>> = {
  zh: { charsPerBeat: 1, voice: 1 },
  ja: { charsPerBeat: 1, voice: 1 },
  ko: { charsPerBeat: 1, voice: 1 },
  en: { charsPerBeat: 3.7, voice: 1.6 },
}
