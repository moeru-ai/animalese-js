import { encodeWav } from '@animalese/dsp'
import { describe, expect, it, vi } from 'vitest'

import { createVoice, loadBanks, TextSplitter } from '../src/index.ts'
import { entries, fakeBanks, pcmBanks } from './fakes.ts'

describe('loadBanks', () => {
  it('fetches the index, then each bank once, relative to the index', async () => {
    const requests: string[] = []
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith('index.json'))
        return Response.json(entries)
      const bank = pcmBanks.find(item => url.includes(`/${item.manifest.id}/`))!
      return url.endsWith('manifest.json')
        ? Response.json(bank.manifest)
        : new Response(encodeWav({ samples: bank.samples, sampleRate: bank.manifest.sampleRate }) as Uint8Array<ArrayBuffer>)
    })
    const banks = await loadBanks('https://example.test/banks/index.json', { fetch: fetcher })
    expect(banks.voices).toEqual(['nova', 'onyx'])
    const [first] = await Promise.all([banks.load('nova', ['zh']), banks.load('nova', ['zh'])])
    expect(first[0]?.manifest.id).toBe('zh-nova')
    expect(requests.filter(url => url.endsWith('zh-nova/manifest.json'))).toHaveLength(1)
    expect(requests).toContain('https://example.test/banks/zh-nova/sprite.wav')
  })

  it('fails clearly when the index is missing', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('nope', { status: 404 }))
    await expect(loadBanks('https://example.test/index.json', { fetch: fetcher })).rejects.toThrow(/404/)
  })
})

describe('createVoice', () => {
  it('chooses the bank recorded closest to its pitch', () => {
    const { banks } = fakeBanks()
    expect(createVoice(banks, { preset: 'cranky' }).bank).toBe('onyx')
    expect(createVoice(banks, { preset: 'peppy' }).bank).toBe('nova')
    expect(createVoice(banks, { preset: 'cranky' }, { bank: 'nova' }).bank).toBe('nova')
  })

  it('reads a voice function on every access', () => {
    const { banks } = fakeBanks()
    let baseHz = 100
    const voice = createVoice(banks, () => ({ baseHz }))
    expect(voice.bank).toBe('onyx')
    baseHz = 400
    expect(voice.bank).toBe('nova')
    expect(voice.options.baseHz).toBe(400)
  })

  it('reports missing languages', () => {
    const { banks } = fakeBanks()
    expect(banks.missing('onyx', ['zh', 'ja'])).toEqual(['ja'])
  })
})

describe('textSplitter', () => {
  it('releases text at spaces and punctuation, keeping unfinished words', () => {
    const splitter = new TextSplitter()
    expect(splitter.push('Hel')).toBeUndefined()
    expect(splitter.push('lo wor')).toEqual({ text: 'Hello ', offset: 0 })
    expect(splitter.push('ld!')).toEqual({ text: 'world!', offset: 6 })
  })

  it('keeps the last character of a Han run for context', () => {
    const splitter = new TextSplitter()
    expect(splitter.push('银行')).toEqual({ text: '银', offset: 0 })
    expect(splitter.push('卡')).toEqual({ text: '行', offset: 1 })
    expect(splitter.flush()).toEqual({ text: '卡', offset: 2 })
  })

  it('waits for a possible small kana', () => {
    const splitter = new TextSplitter()
    expect(splitter.push('き')).toBeUndefined()
    expect(splitter.push('ょう。')).toEqual({ text: 'きょう。', offset: 0 })
  })
})
