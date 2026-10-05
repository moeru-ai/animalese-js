export type LanguageCode = 'zh' | 'ja' | 'ko' | 'en'

export type PauseKind
  = | 'space'
    | 'comma'
    | 'period'
    | 'question'
    | 'exclaim'
    | 'ellipsis'
    | 'newline'
    | 'tie'

interface TokenBase {
  /** Source text this token covers. */
  text: string
  /** Start offset (UTF-16) in the analyzed text. */
  start: number
  /** End offset (exclusive) in the analyzed text. */
  end: number
}

/** A character or syllable that can be voiced. */
export interface UnitToken extends TokenBase {
  kind: 'unit'
  /** Voice unit id, `<bank language>/<name>`, e.g. `zh/ni` or `ja/ka`. */
  unit: string
  /** Unstressed (e.g. neutral-tone 的/了/吗); skipped first when the voice cannot keep up with the text. */
  weak?: boolean
  /**
   * Language of the source text when it differs from the unit's bank, e.g. English
   * syllables voiced with Japanese kana units. Selects the per-language pacing.
   */
  language?: LanguageCode
}

/** Punctuation or whitespace: the text pauses here. */
export interface PauseToken extends TokenBase {
  kind: 'pause'
  pause: PauseKind
}

/** Text that is revealed but makes no sound, such as quotes or brackets. */
export interface SilentToken extends TokenBase {
  kind: 'silent'
}

export type Token = UnitToken | PauseToken | SilentToken

/** The bank language a unit id belongs to: `ja/ka` → `ja`. */
export function unitLanguage(unit: string): LanguageCode {
  return unit.slice(0, unit.indexOf('/')) as LanguageCode
}

/** The language a token was written in, which can differ from the bank that voices it. */
export function tokenLanguage(token: UnitToken): LanguageCode {
  return token.language ?? unitLanguage(token.unit)
}

/** Bank languages needed to voice these tokens. */
export function bankLanguages(tokens: Iterable<Token>): Set<LanguageCode> {
  const languages = new Set<LanguageCode>()
  for (const token of tokens) {
    if (token.kind === 'unit')
      languages.add(unitLanguage(token.unit))
  }
  return languages
}
