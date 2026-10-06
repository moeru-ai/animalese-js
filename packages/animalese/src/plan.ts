import type { LanguageCode, Schedule, Token, VoiceOptions } from '@animalese/core'

import type { Voice } from './voice.ts'

import { bankLanguages, schedule } from '@animalese/core'
import { analyze } from '@animalese/g2p'

/** What a text will sound like, worked out without touching audio. */
export interface SpeechPlan {
  tokens: Token[]
  schedule: Schedule
  voice: VoiceOptions
  /** The recorded voice the units come from. */
  bank: string | undefined
  /** Bank languages the text needs. */
  languages: LanguageCode[]
  /** Needed languages that the bank does not have; their units stay silent. */
  missing: LanguageCode[]
}

/** Analyzes and schedules a whole text, for example to show what will be voiced or skipped. */
export function planSpeech(text: string, voice: Voice, options: { language?: LanguageCode | 'auto', chinese?: 'kana' | 'syllables', seed?: number } = {}): SpeechPlan {
  const tokens = analyze(text, { language: options.language, chinese: options.chinese })
  const resolved = voice.options
  const languages = [...bankLanguages(tokens)]
  const bank = voice.bank
  return {
    tokens,
    schedule: schedule(tokens, options.seed === undefined ? resolved : { ...resolved, seed: options.seed }),
    voice: resolved,
    bank,
    languages,
    missing: bank ? voice.banks.missing(bank, languages) : languages,
  }
}
