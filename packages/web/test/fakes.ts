import type { BankIndexEntry, BankManifest } from '@animalese/core'

import { vi } from 'vitest'

/** Just enough of an AudioContext for the player; tests drive `currentTime` by hand. */
export function fakeAudioContext() {
  const node = () => ({ connect: (next: unknown) => next })
  const sources: { start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn>, rates: ReturnType<typeof vi.fn> }[] = []
  const context = {
    currentTime: 0,
    destination: node(),
    createGain: () => ({ ...node(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }),
    createBufferSource: () => {
      const source = { start: vi.fn(), stop: vi.fn(), rates: vi.fn() }
      sources.push(source)
      return {
        ...node(),
        buffer: null,
        playbackRate: { setValueAtTime: source.rates, exponentialRampToValueAtTime: vi.fn() },
        start: source.start,
        stop: source.stop,
      }
    },
  }
  return { context: context as unknown as AudioContext, clock: context, sources }
}

export function manifest(language: 'zh' | 'ja', voice: string, referenceHz: number): BankManifest {
  return {
    format: 'animalese-bank@1',
    id: `${language}-${voice}`,
    language,
    voice,
    source: 'test',
    sampleRate: 24000,
    referenceHz,
    sprite: 'sprite.wav',
    units: { [`${language}/a`]: { offset: 2400, length: 2400, f0: referenceHz } },
    createdAt: '',
  }
}

export function entry(language: 'zh' | 'ja', voice: string, referenceHz: number): BankIndexEntry {
  return { id: `${language}-${voice}`, language, voice, source: 'test', referenceHz, units: 1, manifest: `${language}-${voice}/manifest.json` }
}

/** Serves `index.json`, manifests and sprites from memory and records every request. */
export function fakeServer(entries: BankIndexEntry[]) {
  const requests: string[] = []
  let failNext = false
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    requests.push(url)
    if (failNext) {
      failNext = false
      return new Response('nope', { status: 500 })
    }
    if (url.endsWith('index.json'))
      return Response.json(entries)
    const match = url.match(/\/(\w+)-(\w+)\/(manifest\.json|sprite\.wav)$/)
    if (!match)
      return new Response('missing', { status: 404 })
    const [, language, voice, file] = match
    const found = entries.find(item => item.id === `${language}-${voice}`)!
    return file === 'manifest.json'
      ? Response.json(manifest(language as 'zh', voice!, found.referenceHz))
      : new Response(new ArrayBuffer(8))
  }) as unknown as typeof fetch
  const decoder = { decodeAudioData: vi.fn(async () => ({ duration: 1 }) as AudioBuffer) } as unknown as BaseAudioContext
  return {
    fetch: fetcher,
    context: decoder,
    requests,
    failNext: () => {
      failNext = true
    },
  }
}
