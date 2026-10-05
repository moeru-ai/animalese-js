import type { PauseKind, Schedule, Token, UnitEvent } from '../src/index.ts'

/** One Chinese character per unit token, as the zh frontend produces. */
export function unit(name: string, index: number, extra: Partial<Extract<Token, { kind: 'unit' }>> = {}): Token {
  return { kind: 'unit', unit: `zh/${name}`, text: '字', start: index, end: index + 1, ...extra }
}

export function pause(kind: PauseKind, index: number): Token {
  return { kind: 'pause', pause: kind, text: '。', start: index, end: index + 1 }
}

export function units(plan: Schedule): UnitEvent[] {
  return plan.events.filter(event => event.type === 'unit')
}

export const semitones = (hz: number, base: number): number => 12 * Math.log2(hz / base)

export const sentence: Token[] = ['ni', 'hao', 'a', 'wo', 'shi', 'ta', 'de', 'peng', 'you'].map((name, index) => unit(name, index))
