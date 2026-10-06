import type { Banks, LanguageCode, VoicePreset } from 'animalese'

import { createContext, use } from 'react'
import { useTranslation } from 'react-i18next'

export interface AnimaleseState {
  banks: Banks | null
  error: string | null
  /** The shared playback context, created and resumed on demand (call it in a user gesture). */
  audioContext: () => AudioContext
}

export const AnimaleseContext = createContext<AnimaleseState>({
  banks: null,
  error: null,
  audioContext: () => new AudioContext(),
})

export function useAnimalese(): AnimaleseState {
  return use(AnimaleseContext)
}

export const languageColors = {
  zh: 'app-red',
  ja: 'app-pink',
  ko: 'app-blue',
  en: 'app-green',
} as const satisfies Record<LanguageCode, string>

export function useAnimaleseNames(): { languageNames: Record<LanguageCode, string>, presetNames: Record<VoicePreset, string> } {
  const { t } = useTranslation()
  return {
    languageNames: {
      zh: t('language.zh'),
      ja: t('language.ja'),
      ko: t('language.ko'),
      en: t('language.en'),
    },
    presetNames: {
      normal: t('preset.normal'),
      peppy: t('preset.peppy'),
      cranky: t('preset.cranky'),
      lazy: t('preset.lazy'),
      snooty: t('preset.snooty'),
      jock: t('preset.jock'),
      smug: t('preset.smug'),
      sisterly: t('preset.sisterly'),
    },
  }
}
