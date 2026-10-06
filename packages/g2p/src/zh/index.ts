import type { Token, UnitDefinition } from '@animalese/core'

import type { Frontend } from '../shared.ts'

import { hashString } from '@animalese/core'
import { getInitialAndFinal, pinyin } from 'pinyin-pro'

import { nonUnitToken } from '../shared.ts'
import { pinyinToKana } from './kana.ts'
import { syllables } from './syllables.ts'

const syllableNames = Object.keys(syllables)

const digits: Record<string, string> = {
  0: 'ling',
  1: 'yi',
  2: 'er',
  3: 'san',
  4: 'si',
  5: 'wu',
  6: 'liu',
  7: 'qi',
  8: 'ba',
  9: 'jiu',
}

/** Syllabic nasals have no initial; pinyin-pro would split `ng` into n + g. */
const syllabicNasals = new Set(['m', 'n', 'ng', 'hm', 'hng'])

function chartOf(name: string): { row: string, column: string } {
  if (syllabicNasals.has(name))
    return { row: '', column: name }
  const { initial, final } = getInitialAndFinal(name)
  // After j, q, x and y a written u is ü (ju, yuan), so chart it with the ü finals.
  const column = /^[jqxy]$/.test(initial) ? final.replace(/^u/, 'ü') : final
  return { row: initial, column: column.replace('v', 'ü') }
}

const inventory: UnitDefinition[] = syllableNames.map(name => ({
  id: `zh/${name}`,
  carrier: syllables[name]!,
  reading: name.replace('v', 'ü'),
  chart: chartOf(name),
}))

/**
 * Mandarin: one unit per character, from its toneless pinyin syllable.
 *
 * pinyin-pro resolves polyphones from context (e.g. 银行 → hang, 行走 → xing), which is
 * as close as we can get to "what the subtitle says" without the game's own tables.
 * Tones are dropped on purpose; the melody comes from the scheduler instead. Neutral-tone
 * syllables are flagged `weak` so the scheduler can skip them when the voice falls behind.
 */
function analyzeWith(text: string, offset: number, unitOf: (syllable: string) => { unit: string, language?: 'zh' }): Token[] {
  const items = pinyin(text, { type: 'all', toneType: 'none', v: true })
  const tokens: Token[] = []
  let cursor = 0
  for (const item of items) {
    const start = text.indexOf(item.origin, cursor)
    cursor = start + item.origin.length
    const at = offset + start
    const base = { text: item.origin, start: at, end: at + item.origin.length }

    const syllable = item.isZh ? item.pinyin.replace('ü', 'v') : digits[item.origin]
    if (syllable && syllables[syllable]) {
      // Neutral tone (的、了、吗、们…) marks the syllables the voice may skip first.
      tokens.push({ kind: 'unit', ...unitOf(syllable), ...base, ...(item.isZh && item.num === 0 && { weak: true }) })
    }
    else if (item.isZh) {
      // Rare characters without a reading still get a stable, plausible syllable.
      const fallback = syllableNames[hashString(item.origin) % syllableNames.length]!
      tokens.push({ kind: 'unit', ...unitOf(fallback), ...base })
    }
    else {
      tokens.push(nonUnitToken(item.origin, at))
    }
  }
  return tokens
}

/** Mandarin with its own syllables: every character voices its toneless pinyin syllable. */
export const zh: Frontend = {
  language: 'zh',
  inventory,
  analyze: (text, offset = 0) => analyzeWith(text, offset, syllable => ({ unit: `zh/${syllable}` })),
}

/**
 * Mandarin as the game voices it: each syllable maps to the nearest kana from the Japanese
 * bank. ACNH has one shared Kana bank for every language, and whole Mandarin syllables are
 * too easy to understand, which is not the effect of Animalese.
 */
export const zhKana: Frontend = {
  language: 'zh',
  inventory: [],
  analyze: (text, offset = 0) => analyzeWith(text, offset, syllable => ({ unit: `ja/${pinyinToKana(syllable)}`, language: 'zh' })),
}
