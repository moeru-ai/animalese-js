import { describe, expect, it } from 'vitest'

import { BankLibrary } from '../src/index.ts'
import { entry, fakeServer } from './fakes.ts'

const entries = [entry('zh', 'nova', 196), entry('ja', 'nova', 175), entry('zh', 'onyx', 98)]
const indexUrl = 'https://example.test/banks/index.json'

describe('bankLibrary', () => {
  it('loads an index and lists its voices', async () => {
    const server = fakeServer(entries)
    const library = await BankLibrary.fromIndex(indexUrl, server)
    expect(library.voices).toEqual(['nova', 'onyx'])
  })

  it('picks the voice recorded closest to a pitch', () => {
    const library = new BankLibrary(entries, indexUrl)
    expect(library.voiceFor(115)).toBe('onyx')
    expect(library.voiceFor(450)).toBe('nova')
  })

  it('reports languages a voice has no bank for', () => {
    const library = new BankLibrary(entries, indexUrl)
    expect(library.missing('onyx', ['zh', 'ja', 'zh'])).toEqual(['ja'])
    expect(library.missing('nova', ['zh', 'ja'])).toEqual([])
  })

  it('loads the requested banks relative to the index, once', async () => {
    const server = fakeServer(entries)
    const library = new BankLibrary(entries, indexUrl, server)
    const [first, second] = await Promise.all([library.load('nova', ['zh', 'ja']), library.load('nova', ['zh'])])
    expect(Object.keys(first).sort()).toEqual(['ja', 'zh'])
    expect(second.zh).toBe(first.zh)
    expect(server.requests.filter(url => url.endsWith('zh-nova/manifest.json'))).toHaveLength(1)
    expect(server.requests).toContain('https://example.test/banks/zh-nova/sprite.wav')
  })

  it('skips languages the voice lacks', async () => {
    const server = fakeServer(entries)
    const library = new BankLibrary(entries, indexUrl, server)
    expect(Object.keys(await library.load('onyx', ['zh', 'ja']))).toEqual(['zh'])
  })

  it('retries a bank whose download failed', async () => {
    const server = fakeServer(entries)
    const library = new BankLibrary(entries, indexUrl, server)
    server.failNext()
    await expect(library.load('nova', ['zh'])).rejects.toThrow(/500/)
    expect((await library.load('nova', ['zh'])).zh?.manifest.id).toBe('zh-nova')
  })
})
