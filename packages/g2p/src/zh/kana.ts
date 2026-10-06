import { getInitialAndFinal } from 'pinyin-pro'

import { ja } from '../ja/index.ts'

const kana = new Set(ja.inventory.map(unit => unit.id.slice(3)))

/** Pinyin initials as the start of a kana row. */
const rows: Record<string, string> = {
  b: 'b',
  p: 'p',
  m: 'm',
  f: 'h',
  d: 'd',
  t: 't',
  n: 'n',
  l: 'r',
  g: 'g',
  k: 'k',
  h: 'h',
  j: 'j',
  q: 'ch',
  x: 'sh',
  zh: 'j',
  ch: 'ch',
  sh: 'sh',
  r: 'r',
  z: 'z',
  c: 'ch',
  s: 's',
  y: 'y',
  w: 'w',
}

/** The main vowel of a final, as one of the five kana vowels. */
function vowelOf(final: string, initial: string): string {
  // zhi, chi, shi, ri, zi, ci, si: the apical vowel sounds closest to a Japanese u.
  if (final === 'i' && /^(?:zh|ch|sh|[rzcs])$/.test(initial))
    return 'u'
  const core = final.replace(/^[iuü]/, '').replace(/n?g?$/, '') || final[0]!
  if (core.startsWith('a'))
    return 'a'
  if (core.startsWith('o'))
    return 'o'
  if (core.startsWith('e') || core === 'er')
    return 'e'
  if (core.startsWith('u') || core.startsWith('ü'))
    return 'u'
  return 'i'
}

/** Kana spelling fixes for combinations Japanese does not have. */
const fixes: Record<string, string> = {
  si: 'shi',
  ti: 'chi',
  tu: 'tsu',
  hu: 'fu',
  zi: 'ji',
  di: 'ji',
  du: 'zu',
  wi: 'i',
  we: 'e',
  wo: 'o',
  wu: 'u',
  yi: 'i',
  ye: 'e',
  she: 'shi',
  che: 'chi',
  je: 'ji',
}

/**
 * The nearest kana mora for a toneless pinyin syllable (ü written as v): the initial picks
 * the kana row and the main vowel picks the column. Finals with a medial i use a yōon
 * (liang → rya) where Japanese has one. Nasal codas are dropped, as a mora has none.
 */
export function pinyinToKana(syllable: string): string {
  if (/^(?:m|n|ng|hm|hng)$/.test(syllable))
    return 'n'
  const { initial, final } = getInitialAndFinal(syllable)
  const plainFinal = final.replace('v', 'ü')
  const vowel = vowelOf(plainFinal, initial)
  const row = rows[initial] ?? ''
  const glide = /^i[aou]/.test(plainFinal) && row !== '' && row !== 'y'
  const candidates = [
    ...(glide ? [`${row.length === 1 ? `${row}y` : row}${vowel}`] : []),
    fixes[row + vowel] ?? row + vowel,
    vowel,
  ]
  return candidates.find(name => kana.has(name)) ?? vowel
}
