import type { Token, UnitDefinition } from '@animalese/core'
import type { Frontend } from '../shared.ts'

import { ja } from '../ja/index.ts'
import { characters, nonUnitToken } from '../shared.ts'

const kana = new Set(ja.inventory.map(unit => unit.id.slice(3)))

/** Spelling of a consonant (or digraph) as the start of a kana row. */
const consonants: Record<string, string> = {
  b: 'b',
  c: 'k',
  d: 'd',
  f: 'h',
  g: 'g',
  h: 'h',
  j: 'j',
  k: 'k',
  l: 'r',
  m: 'm',
  n: 'n',
  p: 'p',
  q: 'k',
  r: 'r',
  s: 's',
  t: 't',
  v: 'b',
  w: 'w',
  x: 'z',
  y: 'y',
  z: 'z',
  sh: 'sh',
  ch: 'ch',
  th: 's',
  ph: 'h',
  wh: 'w',
  ck: 'k',
  qu: 'k',
  gh: 'g',
}

/** English vowel spellings folded to the five kana vowels. */
const vowels: [RegExp, string][] = [
  [/^(?:ee|ea|ie|ey|i|y)/, 'i'],
  [/^(?:oo|ou|ew|ue|u)/, 'u'],
  [/^(?:ai|ay|ei|e)/, 'e'],
  [/^(?:oa|ow|oe|au|aw|oi|oy|o)/, 'o'],
  [/^a/, 'a'],
]

/** Kana spelling fixes for combinations Japanese does not have (si → shi, tu → tsu…). */
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
  ji: 'ji',
}

/** Unstressed function words; the voice may skip them when it falls behind. */
const functionWords = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'is', 'it', 'as', 'for', 'but', 'be', 'was', 'are'])

const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

function toKana(onset: string, nucleus: string): string {
  const vowel = vowels.find(([pattern]) => pattern.test(nucleus))?.[1] ?? 'a'
  // Soft c and g before e, i, y.
  let consonant = onset ? consonants[onset] ?? consonants[onset[0]!] ?? '' : ''
  if (/^[ei]/.test(nucleus) && onset === 'c')
    consonant = 's'
  if (/^[ei]/.test(nucleus) && onset === 'g')
    consonant = 'j'
  const name = fixes[consonant + vowel] ?? consonant + vowel
  return kana.has(name) ? name : vowel
}

/** First consonant of an onset cluster, skipping a leading s in st/sp/sk ("star" → "ta"). */
function onsetConsonant(cluster: string): string {
  const body = /^s[ptk]/.test(cluster) ? cluster.slice(1) : cluster
  const digraph = body.slice(0, 2)
  return consonants[digraph] && digraph.length === 2 ? digraph : body.slice(0, 1)
}

interface Syllable {
  kana: string
  start: number
  end: number
}

/**
 * Orthographic syllabification, good enough for babble: one syllable per vowel group,
 * minus a silent final e and non-syllabic -ed/-es endings.
 */
export function syllabify(word: string): Syllable[] {
  const lower = word.toLowerCase()
  const groups = [...lower.matchAll(/[aeiou]+|(?<=[^aeiou])y(?![aeiou])/g)].map(match => ({ start: match.index, end: match.index + match[0].length }))
  if (groups.length > 1) {
    const last = groups.at(-1)!
    const ending = lower.slice(last.start)
    const before = lower[last.start - 1] ?? ''
    const silentE = ending === 'e' && !/[^aeiou]le$/.test(lower)
    const silentEd = ending === 'ed' && !/[td]$/.test(before)
    const silentEs = ending === 'es' && !/(?:[sxz]|ch|sh|[cg])$/.test(lower.slice(0, last.start))
    if (silentE || silentEd || silentEs)
      groups.pop()
  }
  if (groups.length === 0)
    return [{ kana: toKana(onsetConsonant(lower), 'a'), start: 0, end: word.length }]

  const syllables = groups.map((group, index) => {
    const previousEnd = index === 0 ? 0 : groups[index - 1]!.end
    const cluster = lower.slice(previousEnd, group.start)
    // Between vowels, the last consonant (or digraph) starts the next syllable.
    const onset = index === 0
      ? onsetConsonant(cluster)
      : cluster.length >= 2 && consonants[cluster.slice(-2)] ? cluster.slice(-2) : cluster.slice(-1)
    return {
      kana: toKana(onset, lower.slice(group.start, group.end)),
      start: index === 0 ? 0 : group.start - onset.length,
      end: word.length,
    }
  })
  // Each syllable's text runs up to where the next one starts.
  syllables.forEach((syllable, index) => {
    syllable.end = syllables[index + 1]?.start ?? word.length
  })
  return syllables
}

/**
 * English frontend, calibrated on ACNH English recordings: about one unit per syllable
 * (not per letter), each mapped to the nearest kana from the Japanese bank. The game's
 * ordinary dialogue draws on one shared Kana bank, so English needs no bank of its own.
 */
function analyze(text: string, offset = 0): Token[] {
  const tokens: Token[] = []
  const chars = characters(text)
  for (let i = 0; i < chars.length;) {
    const { char, start } = chars[i]!
    if (/\d/.test(char)) {
      for (const syllable of syllabify(digitWords[Number(char)]!))
        tokens.push({ kind: 'unit', unit: `ja/${syllable.kana}`, language: 'en', text: char, start: offset + start, end: offset + start + 1 })
      i++
      continue
    }
    if (!/\p{Script=Latin}/u.test(char)) {
      tokens.push(nonUnitToken(char, offset + start))
      i++
      continue
    }
    // A word: Latin letters plus inner apostrophes ("mom's").
    let j = i
    while (j < chars.length && (/\p{Script=Latin}/u.test(chars[j]!.char) || (chars[j]!.char === '\'' && /\p{Script=Latin}/u.test(chars[j + 1]?.char ?? ''))))
      j++
    const word = text.slice(start, chars[j - 1]!.start + 1)
    const plain = word.normalize('NFD').replace(/\p{M}/gu, '')
    const weak = functionWords.has(plain.toLowerCase())
    for (const syllable of syllabify(plain)) {
      tokens.push({
        kind: 'unit',
        unit: `ja/${syllable.kana}`,
        language: 'en',
        text: word.slice(syllable.start, syllable.end),
        start: offset + start + syllable.start,
        end: offset + start + syllable.end,
        ...(weak && { weak }),
      })
    }
    i = j
  }
  return tokens
}

export const en: Frontend = { language: 'en', inventory: [], analyze }

/** Letter names, spelled so a TTS engine does not read them as words ("A" → "uh"). */
const letters: Record<string, string> = {
  a: 'Ay',
  b: 'Bee',
  c: 'See',
  d: 'Dee',
  e: 'Ee',
  f: 'Eff',
  g: 'Gee',
  h: 'Aitch',
  i: 'Eye',
  j: 'Jay',
  k: 'Kay',
  l: 'El',
  m: 'Em',
  n: 'En',
  o: 'Oh',
  p: 'Pee',
  q: 'Cue',
  r: 'Are',
  s: 'Ess',
  t: 'Tee',
  u: 'You',
  v: 'Vee',
  w: 'Wuh',
  x: 'Ex',
  y: 'Why',
  z: 'Zee',
}

const letterInventory: UnitDefinition[] = Object.entries(letters).map(([letter, carrier], index) => ({
  id: `en/${letter}`,
  carrier,
  reading: letter,
  chart: { row: String(Math.floor(index / 7)), column: String(index % 7) },
}))

/**
 * GameCube / animalese.js style: every letter plays its own letter-name sound.
 * Not what ACNH does, but kept for the classic typing-sound effect.
 */
function analyzeLetters(text: string, offset = 0): Token[] {
  const tokens: Token[] = []
  for (const { char, start } of characters(text)) {
    const at = offset + start
    const base = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const spelled = /^\d$/.test(base) ? digitWords[Number(base)]! : base
    if (letters[spelled[0] ?? '']) {
      for (const letter of spelled)
        tokens.push({ kind: 'unit', unit: `en/${letter}`, text: char, start: at, end: at + char.length })
    }
    else {
      tokens.push(nonUnitToken(char, at))
    }
  }
  return tokens
}

export const enLetters: Frontend = { language: 'en', inventory: letterInventory, analyze: analyzeLetters }
