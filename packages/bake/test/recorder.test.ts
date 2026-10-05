import { mkdtemp, readdir, writeFile } from 'node:fs/promises'

import { tmpdir } from 'node:os'

import { join } from 'node:path'
import { encodeWav } from '@animalese/dsp'
import { describe, expect, it, vi } from 'vitest'

import { cachedRecorder, defaultInstructions, isSilent, openAISpeechRecorder } from '../src/index.ts'

const unit = { id: 'zh/ni', carrier: '妮', reading: 'ni', chart: { row: 'n', column: 'i' } }
const wav = () => new Response(encodeWav({ samples: new Float32Array(240).fill(0.1), sampleRate: 24000 }) as Uint8Array<ArrayBuffer>)

function recorder(model: string, responses: (() => Response)[]) {
  const calls: { url: string, init: RequestInit }[] = []
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! })
    return responses.shift()!()
  }) as unknown as typeof fetch
  return { calls, recorder: openAISpeechRecorder({ baseUrl: 'https://tts.test/v1', apiKey: 'key', model, voice: 'nova', retryDelayMs: 0, fetch: fetcher }) }
}

describe('openAISpeechRecorder', () => {
  it('posts the carrier to /audio/speech and decodes the WAV', async () => {
    const { calls, recorder: tts } = recorder('tts-1', [wav])
    const audio = await tts.record(unit, 'zh')
    expect(audio).toMatchObject({ sampleRate: 24000 })
    expect(audio.samples).toHaveLength(240)
    expect(calls[0]!.url).toBe('https://tts.test/v1/audio/speech')
    expect(calls[0]!.init.headers).toMatchObject({ Authorization: 'Bearer key' })
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ model: 'tts-1', voice: 'nova', input: '妮', response_format: 'wav' })
  })

  it('sends per-language instructions only to models that accept them', async () => {
    const { calls, recorder: tts } = recorder('gpt-4o-mini-tts', [wav])
    await tts.record(unit, 'zh')
    expect(JSON.parse(calls[0]!.init.body as string).instructions).toBe(defaultInstructions.zh)
  })

  it('retries failed requests, then gives up with the cause', async () => {
    const failure = () => new Response('busy', { status: 503 })
    const { calls, recorder: tts } = recorder('tts-1', [failure, wav])
    await expect(tts.record(unit, 'zh')).resolves.toBeDefined()
    expect(calls).toHaveLength(2)

    const { recorder: broken } = recorder('tts-1', [failure, failure, failure, failure])
    await expect(broken.record(unit, 'zh')).rejects.toThrow(/zh\/ni/)
  })

  it('treats a silent answer as a failure and retries', async () => {
    const silence = () => new Response(encodeWav({ samples: new Float32Array(7200), sampleRate: 24000 }) as Uint8Array<ArrayBuffer>)
    const { calls, recorder: tts } = recorder('tts-1', [silence, wav])
    expect(isSilent(await tts.record(unit, 'zh'))).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('fingerprints everything that changes a recording', () => {
    const a = openAISpeechRecorder({ baseUrl: 'https://a.test', apiKey: 'k', model: 'tts-1', voice: 'nova' })
    const b = openAISpeechRecorder({ baseUrl: 'https://a.test', apiKey: 'other', model: 'tts-1', voice: 'onyx' })
    expect(a.fingerprint(unit, 'zh')).not.toBe(b.fingerprint(unit, 'zh'))
    // The API key does not change the audio, so it must not change the cache key.
    const c = openAISpeechRecorder({ baseUrl: 'https://a.test', apiKey: 'other', model: 'tts-1', voice: 'nova' })
    expect(a.fingerprint(unit, 'zh')).toBe(c.fingerprint(unit, 'zh'))
  })
})

describe('cachedRecorder', () => {
  it('records again when the cached file is silent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'animalese-cache-'))
    let calls = 0
    const inner = {
      source: 'test',
      fingerprint: () => 'unit',
      record: async () => {
        calls++
        return { sampleRate: 24000, samples: new Float32Array(240).fill(0.2) }
      },
    }
    const recorder = cachedRecorder(inner, directory)
    await recorder.record(unit, 'zh')
    await recorder.record(unit, 'zh')
    expect(calls).toBe(1)

    // Overwrite the cache entry with silence, as an earlier bake might have stored.
    const [file] = await readdir(directory)
    await writeFile(join(directory, file!), encodeWav({ samples: new Float32Array(240), sampleRate: 24000 }))
    await recorder.record(unit, 'zh')
    expect(calls).toBe(2)
  })
})
