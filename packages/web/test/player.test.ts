import type { SpeechChunk, SpeechMark } from '@animalese/core'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { playSpeech, toMediaStream } from '../src/index.ts'
import { fakeAudioContext } from './fakes.ts'

const mark = (token: number, time: number): SpeechMark => ({ token, time, text: '字', start: token, end: token + 1 })
const chunks: SpeechChunk[] = [
  { samples: new Float32Array(4800), sampleRate: 48000, time: 0, marks: [mark(0, 0), mark(1, 0.05)] },
  { samples: new Float32Array(2400), sampleRate: 24000, time: 0.1, marks: [mark(2, 0.15)] },
]

function streamOf(items: SpeechChunk[]): ReadableStream<SpeechChunk> {
  return new ReadableStream({
    start(controller) {
      items.forEach(item => controller.enqueue(item))
      controller.close()
    },
  })
}

describe('playSpeech', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues chunks back to back on the audio clock, each at its own sample rate', async () => {
    const { context, sources } = fakeAudioContext()
    const playback = playSpeech(streamOf(chunks), { context, latency: 0.05 })
    await vi.advanceTimersByTimeAsync(0)
    expect(sources.map(source => [source.length, source.sampleRate])).toEqual([[4800, 48000], [2400, 24000]])
    expect(sources[0]!.start).toHaveBeenCalledWith(0.05)
    expect(sources[1]!.start).toHaveBeenCalledWith(expect.closeTo(0.15, 9))
    await vi.advanceTimersByTimeAsync(500)
    await expect(playback.finished).resolves.toBeUndefined()
  })

  it('calls onMark in time with the audio', async () => {
    const { context } = fakeAudioContext()
    const seen: number[] = []
    playSpeech(streamOf(chunks), { context, latency: 0.05, onMark: item => seen.push(item.token) })
    await vi.advanceTimersByTimeAsync(60)
    expect(seen).toEqual([0])
    await vi.advanceTimersByTimeAsync(150)
    expect(seen).toEqual([0, 1, 2])
  })

  it('stops the sound and the marks', async () => {
    const { context, sources } = fakeAudioContext()
    const seen: number[] = []
    const playback = playSpeech(streamOf(chunks), { context, onMark: item => seen.push(item.token) })
    await vi.advanceTimersByTimeAsync(0)
    playback.stop()
    await vi.advanceTimersByTimeAsync(1000)
    await playback.finished
    expect(seen).toEqual([])
    expect(sources[0]!.stop).toHaveBeenCalled()
  })
})

describe('toMediaStream', () => {
  it('plays into a MediaStream destination', async () => {
    vi.useFakeTimers()
    const { context, mediaStream, sources } = fakeAudioContext()
    const result = toMediaStream(streamOf(chunks), { context })
    expect(result.stream).toBe(mediaStream)
    await vi.advanceTimersByTimeAsync(0)
    expect(sources).toHaveLength(2)
    result.stop()
    vi.useRealTimers()
  })
})
