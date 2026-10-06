import type { SpeechRecognitionLike } from '../src/index.ts'

import { describe, expect, it, vi } from 'vitest'

import { textStreamFromSpeechRecognition } from '../src/index.ts'

function fakeRecognition() {
  const target = new EventTarget()
  const recognition = Object.assign(target, { continuous: true, interimResults: true, start: vi.fn(), stop: vi.fn() }) satisfies SpeechRecognitionLike
  const emit = (resultIndex: number, results: { transcript: string, isFinal: boolean }[]) => {
    const event = Object.assign(new Event('result'), {
      resultIndex,
      results: results.map(result => Object.assign([{ transcript: result.transcript }], { isFinal: result.isFinal })),
    })
    target.dispatchEvent(event)
  }
  return { recognition, emit, end: () => target.dispatchEvent(new Event('end')) }
}

describe('textStreamFromSpeechRecognition', () => {
  it('streams final transcripts only, and ends with recognition', async () => {
    const { recognition, emit, end } = fakeRecognition()
    const reader = textStreamFromSpeechRecognition(recognition).getReader()
    emit(0, [{ transcript: '你好', isFinal: false }])
    emit(0, [{ transcript: '你好呀', isFinal: true }])
    emit(1, [{ transcript: '你好呀', isFinal: true }, { transcript: '再见', isFinal: true }])
    end()
    const texts: string[] = []
    for (let read = await reader.read(); !read.done; read = await reader.read())
      texts.push(read.value)
    expect(texts).toEqual(['你好呀', '再见'])
  })

  it('stops recognition when the stream is cancelled', async () => {
    const { recognition } = fakeRecognition()
    await textStreamFromSpeechRecognition(recognition).cancel()
    expect(recognition.stop).toHaveBeenCalled()
  })
})
