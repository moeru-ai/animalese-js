import type { LanguageCode, Token } from '@animalese/core'

import type { Frontend } from './shared.ts'

import { en } from './en/index.ts'
import { ja } from './ja/index.ts'
import { ko } from './ko/index.ts'
import { zh, zhKana } from './zh/index.ts'

export { en, enLetters, syllabify } from './en/index.ts'
export type { Frontend } from './shared.ts'
export { ja, ko, zh, zhKana }
export { pinyinToKana } from './zh/kana.ts'

export const frontends: Record<LanguageCode, Frontend> = { zh, ja, ko, en }

export interface AnalyzeOptions {
  /**
   * `auto` routes each script to its frontend: Hangul → ko, kana → ja, Latin → en.
   * Han characters are read as Japanese when the text has any hiragana (Japanese sentences
   * almost always do: particles, okurigana) and as Chinese otherwise, so a Chinese sentence
   * with a katakana loanword (我买了ラッキー) keeps its Chinese part Chinese. All-kanji-and-
   * katakana Japanese such as 東京タワー needs `language: 'ja'`.
   * Fixing the language to zh or ja sends every Han character to that language.
   */
  language?: LanguageCode | 'auto'
  /** Added to every token offset, when `text` is a piece of a longer text. */
  offset?: number
  /**
   * How Chinese is voiced. `kana` (the default) maps each syllable to the nearest kana from
   * the Japanese bank, as the game's shared Kana bank does. `syllables` uses whole Mandarin
   * syllables from the Chinese bank, which is much easier to understand.
   */
  chinese?: 'kana' | 'syllables'
}

type Script = 'han' | 'hiragana' | 'katakana' | 'hangul' | 'latin' | 'neutral'

function scriptOf(char: string): Script {
  if (/\p{Script=Han}/u.test(char))
    return 'han'
  if (/\p{Script=Hiragana}/u.test(char))
    return 'hiragana'
  if (/[\p{Script=Katakana}ー]/u.test(char))
    return 'katakana'
  if (/\p{Script=Hangul}/u.test(char))
    return 'hangul'
  if (/\p{Script=Latin}/u.test(char))
    return 'latin'
  return 'neutral'
}

export function detectLanguage(text: string): LanguageCode {
  const counts: Record<Script, number> = { han: 0, hiragana: 0, katakana: 0, hangul: 0, latin: 0, neutral: 0 }
  for (const char of text)
    counts[scriptOf(char)]++
  if (counts.hiragana > 0 || (counts.katakana > 0 && counts.han + counts.hangul + counts.latin === 0))
    return 'ja'
  const [script] = (['hangul', 'han', 'latin'] as const).toSorted((a, b) => counts[b] - counts[a])
  return script === 'hangul' ? 'ko' : script === 'han' || counts.latin === 0 ? 'zh' : 'en'
}

interface Run {
  script: Exclude<Script, 'neutral'> | undefined
  start: number
  end: number
}

/**
 * Splits mixed text into script runs and sends each run to its language frontend.
 * Digits and punctuation stay with the run before them, so "3 个" reads in Chinese.
 */
export function analyze(text: string, options: AnalyzeOptions = {}): Token[] {
  const fixed = options.language && options.language !== 'auto' ? options.language : undefined

  const runs: Run[] = []
  let start = 0
  for (const char of text) {
    const script = scriptOf(char)
    const last = runs.at(-1)
    if (last && (script === 'neutral' || last.script === script || last.script === undefined)) {
      last.script ??= script === 'neutral' ? undefined : script
      last.end = start + char.length
    }
    else {
      runs.push({ script: script === 'neutral' ? undefined : script, start, end: start + char.length })
    }
    start += char.length
  }

  const fallback = fixed ?? detectLanguage(text)
  const hanLanguage: LanguageCode = fixed === 'zh' || fixed === 'ja'
    ? fixed
    : /\p{Script=Hiragana}/u.test(text) ? 'ja' : 'zh'
  const languages = runs.map((run): LanguageCode => {
    switch (run.script) {
      case 'hiragana':
      case 'katakana': return 'ja'
      case 'hangul': return 'ko'
      case 'latin': return 'en'
      case 'han': return hanLanguage
      default: return fallback
    }
  })

  const offset = options.offset ?? 0
  const chinese = options.chinese === 'syllables' ? zh : zhKana
  return runs.flatMap((run, index) => {
    const language = languages[index]!
    return (language === 'zh' ? chinese : frontends[language]).analyze(text.slice(run.start, run.end), offset + run.start)
  })
}
