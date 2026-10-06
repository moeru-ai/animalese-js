import type { Banks, LanguageCode, VoicePreset } from 'animalese'

import { createContext, use } from 'react'

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

export const languageNames: Record<LanguageCode, string> = {
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  en: 'English',
}

export const languageColors = {
  zh: 'app-red',
  ja: 'app-pink',
  ko: 'app-blue',
  en: 'app-green',
} as const satisfies Record<LanguageCode, string>

/** Chinese names of the villager personalities. */
export const presetNames: Record<VoicePreset, string> = {
  normal: '普通',
  peppy: '元气',
  cranky: '暴躁',
  lazy: '悠闲',
  snooty: '成熟',
  jock: '运动',
  smug: '自恋',
  sisterly: '大姐头',
}
