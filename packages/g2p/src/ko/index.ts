import type { Token, UnitDefinition } from '@animalese/core'
import type { Frontend } from '../shared.ts'

import { assemble, combineVowels, disassembleCompleteCharacter, romanize } from 'es-hangul'

import { characters, nonUnitToken } from '../shared.ts'

const onsets = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

/**
 * Vowels folded to the ones that stay distinct in short, fast babble:
 * ㅐ/ㅔ, ㅒ/ㅖ and ㅙ/ㅚ/ㅞ have merged for most modern speakers anyway.
 */
const vowels: Record<string, string> = {
  ㅏ: 'ㅏ',
  ㅐ: 'ㅔ',
  ㅑ: 'ㅑ',
  ㅒ: 'ㅖ',
  ㅓ: 'ㅓ',
  ㅔ: 'ㅔ',
  ㅕ: 'ㅕ',
  ㅖ: 'ㅖ',
  ㅗ: 'ㅗ',
  ㅘ: 'ㅘ',
  ㅙ: 'ㅞ',
  ㅚ: 'ㅞ',
  ㅛ: 'ㅛ',
  ㅜ: 'ㅜ',
  ㅝ: 'ㅝ',
  ㅞ: 'ㅞ',
  ㅟ: 'ㅟ',
  ㅠ: 'ㅠ',
  ㅡ: 'ㅡ',
  ㅢ: 'ㅢ',
  ㅣ: 'ㅣ',
}

const syllableOf = (onset: string, vowel: string): string => assemble([onset, vowel])

const inventory: UnitDefinition[] = onsets.flatMap(onset =>
  [...new Set(Object.values(vowels))].map((vowel) => {
    const syllable = syllableOf(onset, vowel)
    return { id: `ko/${syllable}`, carrier: syllable, reading: romanize(syllable), chart: { row: onset, column: vowel } }
  }),
)

const digits: Record<string, string> = {
  0: '영',
  1: '일',
  2: '이',
  3: '삼',
  4: '사',
  5: '오',
  6: '육',
  7: '칠',
  8: '팔',
  9: '구',
}

/**
 * Korean frontend: one open (onset + vowel) syllable per Hangul block; the coda is dropped.
 * This follows PyAnimalese and animalese-tts, which both voice blocks rather than jamo.
 */
function analyze(text: string, offset = 0): Token[] {
  const tokens: Token[] = []
  for (const { char, start } of characters(text)) {
    const at = offset + start
    const block = disassembleCompleteCharacter(digits[char] ?? char)
    // es-hangul spells complex vowels as two jamo (ㅝ → ㅜㅓ).
    const jungseong = block && [...block.jungseong].reduce((a, b) => combineVowels(a, b))
    const vowel = jungseong && vowels[jungseong]
    if (block && vowel)
      tokens.push({ kind: 'unit', unit: `ko/${syllableOf(block.choseong, vowel)}`, text: char, start: at, end: at + char.length })
    else
      tokens.push(nonUnitToken(char, at))
  }
  return tokens
}

export const ko: Frontend = { language: 'ko', inventory, analyze }
