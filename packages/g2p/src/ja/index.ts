import type { Token, UnitDefinition } from '@animalese/core'
import type { Frontend } from '../shared.ts'

import { hashString } from '@animalese/core'
import { toHiragana } from 'wanakana'

import { characters, nonUnitToken } from '../shared.ts'

// Mora table adapted from izure1/animalese-tts (MIT), JapaneseAnalyzer.
const morae: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'o',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ゔ: 'bu',
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  // Small vowels and small ya/yu/yo on their own sound like their full-size forms.
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
  ゎ: 'wa',
}

/** One carrier per unit name; the first kana listed wins (e.g. を and お both record "o" as お). */
const carriers = new Map<string, string>()
for (const [kana, name] of Object.entries(morae)) {
  if (!carriers.has(name))
    carriers.set(name, kana)
}
const unitNames = [...carriers.keys()]
const plainMorae = unitNames.filter(name => !name.includes('y') || name.length === 2)

/** Gojūon rows, each spelled across the a, i, u, e, o columns. */
const gojuon = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や　ゆ　よ', 'らりるれろ', 'わ　　　を', 'がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ']
const columns = ['a', 'i', 'u', 'e', 'o']
const smallColumns: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }

/** Rows are named by their a-column kana (か, さ…), yōon rows by the i-column kana plus ゃ (きゃ…). */
function chartOf(kana: string): { row: string, column: string } {
  if (kana === 'ん')
    return { row: 'ん', column: 'n' }
  if (kana.length === 2)
    return { row: `${kana[0]}ゃ`, column: smallColumns[kana[1]!]! }
  const row = gojuon.find(line => line.includes(kana))
  return row ? { row: row[0]!, column: columns[row.indexOf(kana)]! } : { row: 'ゔ', column: 'u' }
}

const inventory: UnitDefinition[] = unitNames.map((name) => {
  const kana = carriers.get(name)!
  return { id: `ja/${name}`, carrier: kana, reading: name, chart: chartOf(kana) }
})

const vowelOf = (name: string): string => name.at(-1) === 'n' && name.length === 1 ? 'n' : name.at(-1)!
const isKanji = (char: string): boolean => /\p{Script=Han}/u.test(char)

/**
 * Japanese frontend: one unit per mora, as in the game's `Kana` banks.
 *
 * Katakana is folded to hiragana, ー repeats the previous vowel and っ becomes a short tie.
 * Kanji need a dictionary (kuromoji or similar) to read correctly; until one is wired in,
 * each kanji maps to a stable pseudo-random mora so the rhythm still matches the text.
 */
function analyze(text: string, offset = 0): Token[] {
  const tokens: Token[] = []
  const chars = characters(text)
  let previous: string | undefined
  for (let i = 0; i < chars.length; i++) {
    const { char, start } = chars[i]!
    const at = offset + start
    const kana = toHiragana(char, { passRomaji: true })
    const next = chars[i + 1]
    const pair = next ? kana + toHiragana(next.char, { passRomaji: true }) : ''

    if (morae[pair]) {
      previous = morae[pair]
      tokens.push({ kind: 'unit', unit: `ja/${previous}`, text: char + next!.char, start: at, end: at + char.length + next!.char.length })
      i++
    }
    else if (morae[kana]) {
      previous = morae[kana]
      tokens.push({ kind: 'unit', unit: `ja/${previous}`, text: char, start: at, end: at + char.length })
    }
    else if (kana === 'っ') {
      tokens.push({ kind: 'pause', pause: 'tie', text: char, start: at, end: at + char.length })
    }
    else if (kana === 'ー' && previous) {
      previous = vowelOf(previous)
      tokens.push({ kind: 'unit', unit: `ja/${previous}`, text: char, start: at, end: at + char.length })
    }
    else if (isKanji(char)) {
      previous = plainMorae[hashString(char) % plainMorae.length]!
      tokens.push({ kind: 'unit', unit: `ja/${previous}`, text: char, start: at, end: at + char.length })
    }
    else {
      previous = undefined
      tokens.push(nonUnitToken(char, at))
    }
  }
  return tokens
}

export const ja: Frontend = { language: 'ja', inventory, analyze }
