import type { LanguageCode, SpeechChunk, SpeechEvent, SpeechMark, Token } from '@animalese/core'
import type { PcmBank, UnitSource } from '@animalese/dsp'

import type { Voice } from './voice.ts'

import { bankLanguages, createScheduler, unitLanguage } from '@animalese/core'
import { createRenderer, encodeWav, sliceUnit } from '@animalese/dsp'
import { analyze } from '@animalese/g2p'

import { TextSplitter } from './text.ts'

/** Text to speak: a whole string, or pieces that arrive over time. */
export type SpeechInput = string | ReadableStream<string> | AsyncIterable<string>

export interface SpeechOptions {
  /** See `analyze`. With `auto`, Han characters read as Japanese once the text has hiragana. */
  language?: LanguageCode | 'auto'
  /** See `analyze`: `kana` (the default) or whole Mandarin `syllables`. */
  chinese?: 'kana' | 'syllables'
  /** Defaults to 48000. */
  sampleRate?: number
  /** Overrides the seed of the voice and the text-derived default. */
  seed?: number
  /**
   * For streamed input: when no new text arrives for this long, the current sentence ends
   * as if a full stop had been typed, so its last units can play. Defaults to 500 ms.
   */
  idleMs?: number
  /** Longest chunk in seconds, so that playback and marks can start early. Defaults to 0.5. */
  chunkSeconds?: number
}

const releaseSeconds = 0.012
const idle = Symbol('idle')

async function* once(text: string): AsyncGenerator<string> {
  yield text
}

function pieces(input: SpeechInput): AsyncIterator<string> {
  if (typeof input === 'string')
    return once(input)
  if (input instanceof ReadableStream) {
    const reader = input.getReader()
    return {
      next: () => reader.read() as Promise<IteratorResult<string>>,
      return: async () => {
        await reader.cancel()
        return { done: true, value: undefined }
      },
    }
  }
  return input[Symbol.asyncIterator]()
}

/**
 * Speaks text as a stream of audio chunks. Text can stream in too, for example from an LLM
 * or from speech recognition: the audio follows as the text arrives.
 *
 * Each chunk carries mono samples and the marks of the tokens that appear while it plays.
 * Play chunks with `playSpeech`, turn them into a `MediaStream` with `toMediaStream`, or
 * collect them into a file with `generateSpeech`.
 */
export function streamSpeech(input: SpeechInput, voice: Voice, options: SpeechOptions = {}): ReadableStream<SpeechChunk> {
  const { sampleRate = 48000, idleMs = 500, chunkSeconds = 0.5 } = options
  const live = typeof input !== 'string'
  const source = pieces(input)
  const splitter = new TextSplitter()
  const scheduler = createScheduler(voice.source, { seed: options.seed })

  // Banks by `voice/language`. A unit uses the bank of the voice at the moment it is voiced.
  const banks = new Map<string, PcmBank>()
  const sourceOf = (unit: string, voiceName: string): UnitSource | undefined => {
    const bank = banks.get(`${voiceName}/${unitLanguage(unit)}`)
    const entry = bank?.manifest.units[unit]
    return bank && entry ? { samples: sliceUnit(bank.samples, entry), sampleRate: bank.manifest.sampleRate, referenceHz: bank.manifest.referenceHz } : undefined
  }
  const renderer = createRenderer(undefined, sampleRate)

  const marks: SpeechMark[] = []
  let inputDone = false
  let ended = false
  // Text pushed since the last flush, so a quiet input is flushed once and not again.
  let dirty = false
  // A read that lost the race to the idle timer is kept for the next call.
  let pending: Promise<IteratorResult<string>> | undefined

  const tokensFor = (piece: { text: string, offset: number } | undefined): Token[] => {
    if (!piece)
      return []
    const language = options.language && options.language !== 'auto'
      ? options.language
      : /\p{Script=Hiragana}/u.test(splitter.text) ? 'ja' : 'auto'
    return analyze(piece.text, { language, chinese: options.chinese, offset: piece.offset })
  }

  const accept = async (events: SpeechEvent[]): Promise<void> => {
    const units = events.filter(event => event.type === 'unit')
    const bank = voice.bank
    if (bank && units.length > 0) {
      const needed = bankLanguages(units.map(event => scheduler.tokens[event.token]!))
      for (const loaded of await voice.banks.load(bank, needed))
        banks.set(`${bank}/${loaded.manifest.language}`, loaded)
    }
    for (const event of events) {
      if (event.type === 'mark') {
        const token = scheduler.tokens[event.token]!
        marks.push({ time: event.time, token: event.token, text: token.text, start: token.start, end: token.end })
        continue
      }
      renderer.add(event, bank ? sourceOf(event.unit, bank) : undefined)
    }
    marks.sort((a, b) => a.time - b.time || a.token - b.token)
  }

  // Reads the next piece of text, or reports that the input has been quiet for `idleMs`.
  const next = async (): Promise<IteratorResult<string> | typeof idle> => {
    if (!live || !dirty)
      return pending ??= source.next()
    let timer: ReturnType<typeof setTimeout> | undefined
    const quiet = new Promise<typeof idle>((resolve) => {
      timer = setTimeout(resolve, idleMs, idle)
    })
    try {
      return await Promise.race([pending ??= source.next(), quiet])
    }
    finally {
      clearTimeout(timer)
    }
  }
  const advance = async (): Promise<void> => {
    if (inputDone) {
      if (!ended) {
        await accept([...scheduler.push(tokensFor(splitter.flush())), ...scheduler.end()])
        ended = true
      }
      return
    }
    const result = await next()
    if (result === idle) {
      dirty = false
      await accept([...scheduler.push(tokensFor(splitter.flush())), ...scheduler.flush()])
      return
    }
    pending = undefined
    if (result.done) {
      inputDone = true
    }
    else {
      dirty = true
      await accept(scheduler.push(tokensFor(splitter.push(result.value))))
    }
  }

  // Compare positions in whole samples: the renderer rounds every time to a sample.
  const toSample = (seconds: number): number => Math.round(seconds * sampleRate)

  return new ReadableStream<SpeechChunk>({
    async pull(controller) {
      for (;;) {
        // A whole string is known up front: plan it completely, so the audio ends with the
        // last sound instead of the pause after the final punctuation.
        if (!live && !ended) {
          await advance()
          continue
        }
        const end = ended ? scheduler.duration + releaseSeconds : scheduler.horizon
        const until = Math.min(end, renderer.position + chunkSeconds)
        if (toSample(until) > toSample(renderer.position)) {
          const time = renderer.position
          const samples = renderer.take(until)
          const done = ended && toSample(renderer.position) >= toSample(end)
          const due = done ? marks.length : marks.findIndex(mark => mark.time >= renderer.position)
          controller.enqueue({ samples, sampleRate, time, marks: marks.splice(0, due === -1 ? marks.length : due) })
          if (done)
            controller.close()
          return
        }
        if (ended) {
          // Marks of trailing punctuation can come after the last sound.
          if (marks.length > 0)
            controller.enqueue({ samples: new Float32Array(0), sampleRate, time: renderer.position, marks: marks.splice(0) })
          controller.close()
          return
        }
        await advance()
      }
    },
    async cancel() {
      await source.return?.()
    },
  })
}

/** Speaks text into a 16-bit mono WAV file. */
export async function generateSpeech(input: SpeechInput, voice: Voice, options: SpeechOptions = {}): Promise<Uint8Array> {
  const chunks: Float32Array[] = []
  let sampleRate = options.sampleRate ?? 48000
  // A reader loop, because some browsers cannot iterate a ReadableStream with `for await`.
  const reader = streamSpeech(input, voice, options).getReader()
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    chunks.push(read.value.samples)
    sampleRate = read.value.sampleRate
  }
  const samples = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }
  return encodeWav({ samples, sampleRate })
}
