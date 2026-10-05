import type { LanguageCode, UnitDefinition } from '@animalese/core'
import type { PcmAudio } from '@animalese/dsp'

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { decodeWav, encodeWav, peak } from '@animalese/dsp'

/** Something that can produce a recording of one unit's carrier text. */
export interface Recorder {
  /** Human-readable voice description, e.g. `openai:gpt-4o-mini-tts:nova`. */
  source: string
  /** Everything that changes the recording of a unit, used as the cache key. */
  fingerprint: (unit: UnitDefinition, language: LanguageCode) => string
  record: (unit: UnitDefinition, language: LanguageCode) => Promise<PcmAudio>
}

export interface OpenAISpeechOptions {
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  /** Extra style instructions; only sent to models that accept them (gpt-4o-*-tts). */
  instructions?: Partial<Record<LanguageCode, string>>
  /** Attempts after the first failure. Defaults to 3. */
  retries?: number
  /** Delay before the first retry, doubled for each further one. Defaults to 500 ms. */
  retryDelayMs?: number
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

export const defaultInstructions: Record<LanguageCode, string> = {
  zh: '用标准普通话清楚地读出这一个字。平稳、短促、音量适中，只读这个字，不要拖长，前后不要有任何其他声音。',
  ja: 'この一つの音だけを、標準語で短くはっきりと読んでください。伸ばさず、前後に何も付けないでください。',
  ko: '이 한 글자만 표준어로 짧고 또렷하게 읽어 주세요. 길게 끌지 말고 앞뒤에 다른 소리를 넣지 마세요.',
  en: 'Say only this single letter name, short and clear, in a neutral American accent. Do not add anything before or after.',
}

/**
 * TTS endpoints occasionally answer a single syllable with a short clip of silence.
 * Such a recording is useless as a unit, so it counts as a failed request.
 */
export function isSilent(audio: PcmAudio, thresholdDb = -40): boolean {
  return peak(audio.samples) < 10 ** (thresholdDb / 20)
}

/** Records units through any OpenAI-compatible `/audio/speech` endpoint. */
export function openAISpeechRecorder(options: OpenAISpeechOptions): Recorder {
  const { baseUrl, apiKey, model, voice, retries = 3, retryDelayMs = 500, fetch: fetcher = fetch } = options
  const instructions = { ...defaultInstructions, ...options.instructions }
  const endpoint = new URL('audio/speech', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const acceptsInstructions = /gpt-4o.*tts/.test(model)

  return {
    source: `openai:${model}:${voice}`,
    fingerprint: (unit, language) => JSON.stringify([baseUrl, model, voice, unit.carrier, acceptsInstructions ? instructions[language] : null]),
    async record(unit, language) {
      const body = {
        model,
        voice,
        input: unit.carrier,
        response_format: 'wav',
        ...(acceptsInstructions && { instructions: instructions[language] }),
      }
      let lastError: unknown
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetcher(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!response.ok)
            throw new Error(`TTS ${response.status}: ${(await response.text()).slice(0, 200)}`)
          const audio = decodeWav(new Uint8Array(await response.arrayBuffer()))
          if (isSilent(audio))
            throw new Error('TTS returned silence')
          return audio
        }
        catch (error) {
          lastError = error
          if (attempt < retries)
            await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** attempt))
        }
      }
      throw new Error(`failed to record ${unit.id} (${unit.carrier})`, { cause: lastError })
    },
  }
}

/**
 * Keeps raw recordings on disk so re-baking with new DSP settings costs no API calls.
 * A cached recording that turns out to be silent is recorded again.
 */
export function cachedRecorder(recorder: Recorder, directory: string): Recorder {
  return {
    ...recorder,
    async record(unit, language) {
      const key = createHash('sha256').update(recorder.fingerprint(unit, language)).digest('hex').slice(0, 24)
      const path = join(directory, `${key}.wav`)
      try {
        const cached = decodeWav(await readFile(path))
        if (!isSilent(cached))
          return cached
      }
      catch {}
      const audio = await recorder.record(unit, language)
      await mkdir(directory, { recursive: true })
      await writeFile(path, encodeWav(audio))
      return audio
    },
  }
}
