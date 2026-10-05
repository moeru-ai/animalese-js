import type { Token } from '../src/index.ts'

import { describe, expect, it } from 'vitest'

import { bankLanguages, closestVoice, tokenLanguage, unitLanguage } from '../src/index.ts'

describe('unit and token languages', () => {
  it('reads the bank language from a unit id', () => {
    expect(unitLanguage('zh/zhuang')).toBe('zh')
    expect(unitLanguage('ko/가')).toBe('ko')
  })

  it('prefers the source language of a token', () => {
    expect(tokenLanguage({ kind: 'unit', unit: 'ja/ka', language: 'en', text: 'ca', start: 0, end: 2 })).toBe('en')
    expect(tokenLanguage({ kind: 'unit', unit: 'ja/ka', text: 'か', start: 0, end: 1 })).toBe('ja')
  })

  it('collects the banks a text needs', () => {
    const tokens: Token[] = [
      { kind: 'unit', unit: 'zh/ni', text: '你', start: 0, end: 1 },
      { kind: 'pause', pause: 'space', text: ' ', start: 1, end: 2 },
      { kind: 'unit', unit: 'ja/ha', language: 'en', text: 'hi', start: 2, end: 4 },
    ]
    expect(bankLanguages(tokens)).toEqual(new Set(['zh', 'ja']))
  })
})

describe('closestVoice', () => {
  const entry = (voice: string, referenceHz: number) => ({ id: voice, language: 'zh' as const, voice, source: '', referenceHz, units: 1, manifest: '' })

  it('picks the recording nearest in octaves', () => {
    const entries = [entry('onyx', 98), entry('nova', 196)]
    expect(closestVoice(entries, 115)).toBe('onyx')
    expect(closestVoice(entries, 500)).toBe('nova')
    // 140 Hz is closer to 98 than to 196 on a log scale.
    expect(closestVoice(entries, 138)).toBe('onyx')
  })

  it('returns undefined without banks', () => {
    expect(closestVoice([], 200)).toBeUndefined()
  })
})
