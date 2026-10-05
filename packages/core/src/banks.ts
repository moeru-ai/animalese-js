import type { LanguageCode } from './tokens.ts'

/** One recordable sound in a language inventory. */
export interface UnitDefinition {
  /** `<language>/<name>` */
  id: string
  /** Text sent to the TTS engine to record this unit. */
  carrier: string
  /** Romanized reading for display: pinyin, Hepburn romaji, Revised Romanization… */
  reading: string
  /**
   * Cell in the language's own syllable chart, for display: pinyin initial × final,
   * gojūon row × vowel, Hangul onset × vowel.
   */
  chart: { row: string, column: string }
}

export interface BankUnit {
  /** Offset in the sprite, in samples. */
  offset: number
  /** Length in samples. */
  length: number
  /** Fundamental frequency measured before pitch normalization, in Hz. `null` for unvoiced units. */
  f0: number | null
}

/** `manifest.json` of a baked voice bank. */
export interface BankManifest {
  format: 'animalese-bank@1'
  id: string
  language: LanguageCode
  /** Free-form voice label, e.g. the TTS voice name. */
  voice: string
  /** Where the raw recordings came from, e.g. `openai:gpt-4o-mini-tts:nova`. */
  source: string
  sampleRate: number
  /** Every voiced unit is flattened to this pitch during baking. */
  referenceHz: number
  /** Sprite file name, relative to the manifest. */
  sprite: string
  units: Record<string, BankUnit>
  createdAt: string
}

/** One row of a bank directory's `index.json`. */
export interface BankIndexEntry {
  id: string
  language: LanguageCode
  voice: string
  source: string
  referenceHz: number
  units: number
  /** Manifest path relative to `index.json`. */
  manifest: string
}

/**
 * The voice whose banks were recorded closest to `hz` (in octaves). ACNH ships a bank per
 * personality; picking a deep recording for a deep voice keeps formants natural instead of
 * slowing a high recording down.
 */
export function closestVoice(entries: readonly BankIndexEntry[], hz: number): string | undefined {
  const distance = (entry: BankIndexEntry): number => Math.abs(Math.log2(entry.referenceHz / hz))
  return entries.toSorted((a, b) => distance(a) - distance(b))[0]?.voice
}
