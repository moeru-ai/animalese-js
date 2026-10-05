import type { LanguageCode, PauseKind, Token, UnitDefinition } from '@animalese/core'

export interface Frontend {
  language: LanguageCode
  /** Every unit `analyze` can emit, with the text used to record it. */
  inventory: UnitDefinition[]
  /**
   * Turns a run of text in this language into tokens.
   * Offsets are relative to `text`; `offset` is added to every token.
   */
  analyze: (text: string, offset?: number) => Token[]
}

const pauseMarks: Record<string, PauseKind> = {
  ' ': 'space',
  '　': 'space',
  '\t': 'space',
  ',': 'comma',
  '，': 'comma',
  '、': 'comma',
  ';': 'comma',
  '；': 'comma',
  ':': 'comma',
  '：': 'comma',
  '-': 'comma',
  '—': 'comma',
  '~': 'comma',
  '～': 'comma',
  '.': 'period',
  '。': 'period',
  '．': 'period',
  '?': 'question',
  '？': 'question',
  '!': 'exclaim',
  '！': 'exclaim',
  '…': 'ellipsis',
  '\n': 'newline',
}

export function pauseOf(char: string): PauseKind | undefined {
  return pauseMarks[char]
}

/**
 * Token for anything a frontend does not voice: punctuation becomes a pause,
 * everything else (quotes, brackets, emoji) is revealed silently.
 */
export function nonUnitToken(char: string, start: number): Token {
  const pause = pauseOf(char)
  const end = start + char.length
  return pause ? { kind: 'pause', pause, text: char, start, end } : { kind: 'silent', text: char, start, end }
}

/** Splits text into user-perceived characters so surrogate pairs and emoji stay intact. */
export function characters(text: string): { char: string, start: number }[] {
  const result: { char: string, start: number }[] = []
  let start = 0
  for (const char of text) {
    result.push({ char, start })
    start += char.length
  }
  return result
}
