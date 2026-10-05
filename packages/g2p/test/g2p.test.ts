import type { Token } from '@animalese/core'

import { describe, expect, it } from 'vitest'

import { syllabify } from '../src/en/index.ts'
import { analyze, detectLanguage, enLetters, frontends } from '../src/index.ts'

const names = (tokens: Token[]): string[] => tokens.map(token => token.kind === 'unit' ? token.unit : token.kind === 'pause' ? `|${token.pause}` : '_')

describe('zh', () => {
  it('reads polyphones from context and drops tones', () => {
    expect(names(analyze('银行行走'))).toEqual(['zh/yin', 'zh/hang', 'zh/xing', 'zh/zou'])
  })

  it('marks neutral-tone characters weak', () => {
    const weak = analyze('我们吃饭了吗').filter(token => token.kind === 'unit' && token.weak).map(token => token.text)
    expect(weak).toEqual(['们', '了', '吗'])
  })

  it('maps ü to v and reads digits', () => {
    expect(names(analyze('绿女3'))).toEqual(['zh/lv', 'zh/nv', 'zh/san'])
  })

  it('keeps offsets aligned with the source text', () => {
    const text = '“你好”，世界！'
    for (const token of analyze(text))
      expect(text.slice(token.start, token.end)).toBe(token.text)
  })
})

describe('ja', () => {
  it('handles youon, long vowels and sokuon', () => {
    expect(names(analyze('きょうはラーメンだっけ'))).toEqual(['ja/kyo', 'ja/u', 'ja/ha', 'ja/ra', 'ja/a', 'ja/me', 'ja/n', 'ja/da', '|tie', 'ja/ke'])
  })

  it('folds katakana into the same units as hiragana', () => {
    expect(names(analyze('カタカナ'))).toEqual(names(analyze('かたかな')))
  })

  it('reads kanji as Japanese when the text has kana', () => {
    expect(analyze('天気だ').every(token => token.kind === 'unit' && token.unit.startsWith('ja/'))).toBe(true)
  })
})

describe('ko', () => {
  it('voices open syllables and folds complex vowels', () => {
    expect(names(analyze('반가워요 왜'))).toEqual(['ko/바', 'ko/가', 'ko/워', 'ko/요', '|space', 'ko/웨'])
  })
})

describe('en', () => {
  it('voices one kana unit per syllable', () => {
    expect(syllabify('pasta').map(syllable => syllable.kana)).toEqual(['pa', 'ta'])
    expect(syllabify('truffle').map(syllable => syllable.kana)).toEqual(['tsu', 're'])
    // Silent final e and non-syllabic -ed stay one syllable.
    expect(syllabify('make')).toHaveLength(1)
    expect(syllabify('grated')).toHaveLength(2)
    expect(syllabify('played')).toHaveLength(1)
    expect(names(analyze('Hi 2', { language: 'en' }))).toEqual(['ja/hi', '|space', 'ja/to'])
  })

  it('keeps syllable spans aligned with the text and marks function words weak', () => {
    const text = 'I miss my mom\'s pasta, and the cake!'
    const tokens = analyze(text)
    expect(tokens.map(token => text.slice(token.start, token.end)).join('')).toBe(text)
    expect(tokens.filter(token => token.kind === 'unit' && token.weak).map(token => token.text)).toEqual(['and', 'the'])
  })

  it('still offers the letter-by-letter style', () => {
    expect(names(enLetters.analyze('Hi 2'))).toEqual(['en/h', 'en/i', '|space', 'en/t', 'en/w', 'en/o'])
  })
})

describe('routing', () => {
  it('detects the main language', () => {
    expect(detectLanguage('你好')).toBe('zh')
    expect(detectLanguage('今日はいい天気')).toBe('ja')
    expect(detectLanguage('안녕')).toBe('ko')
    expect(detectLanguage('hello')).toBe('en')
  })

  it('reads Han characters as Chinese when the only kana is katakana', () => {
    const languages = analyze('我买了ラッキー的东西').flatMap(token => token.kind === 'unit' ? [token.unit.slice(0, 2)] : [])
    // ラッキー is ra, (ッ pauses), ki, ー → i.
    expect(languages).toEqual(['zh', 'zh', 'zh', 'ja', 'ja', 'ja', 'zh', 'zh', 'zh'])
  })

  it('follows a fixed language for Han characters', () => {
    expect(analyze('天気', { language: 'ja' }).every(token => token.kind === 'unit' && token.unit.startsWith('ja/'))).toBe(true)
    expect(analyze('天气', { language: 'zh' }).every(token => token.kind === 'unit' && token.unit.startsWith('zh/'))).toBe(true)
  })

  it('turns punctuation into pauses and other symbols into silent tokens', () => {
    expect(names(analyze('好，「好」！'))).toEqual(['zh/hao', '|comma', '_', 'zh/hao', '_', '|exclaim'])
  })

  it('handles empty text', () => {
    expect(analyze('')).toEqual([])
  })

  it('sends each script to its own frontend', () => {
    const languages = analyze('我有 Switch 和 ラッキー').flatMap(token => token.kind === 'unit' ? [token.language ?? token.unit.slice(0, 2)] : [])
    expect(new Set(languages)).toEqual(new Set(['zh', 'en', 'ja']))
  })

  it('only emits units that are in the inventories', () => {
    const inventory = new Set(Object.values(frontends).flatMap(frontend => frontend.inventory.map(unit => unit.id)))
    const corpus = '哎呀，你来啦！今天的天气真不错，要不要一起去钓鱼？嗯，嗲，诶。こんにちは！ヴァイオリン、ぢゃ、ゎ。안녕하세요! 왜 괜찮아? 쉬워. Hey there! Ça va? 0123456789'
    for (const token of analyze(corpus)) {
      if (token.kind === 'unit')
        expect(inventory).toContain(token.unit)
    }
  })
})
