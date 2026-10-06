import { schedule } from '@animalese/core'
import { bankResolver, decodeWav, renderSchedule } from '@animalese/dsp'
import { analyze } from '@animalese/g2p'
import { describe, expect, it } from 'vitest'

import { createVoice, generateSpeech, planSpeech, streamSpeech } from '../src/index.ts'
import { collect, fakeBanks, join, pcmBanks, pieces, sampleRate } from './fakes.ts'

const text = '你好呀，今天天气真好！要一起去钓鱼吗？'

describe('streamSpeech', () => {
  it('matches a whole render of the same schedule, sample for sample', async () => {
    const { banks } = fakeBanks()
    const voice = createVoice(banks, { preset: 'peppy' })
    const streamed = join(await collect(streamSpeech(text, voice, { sampleRate })))
    const nova = pcmBanks.filter(bank => bank.manifest.voice === 'nova')
    const whole = renderSchedule(schedule(analyze(text), { preset: 'peppy' }), bankResolver(nova), sampleRate)
    expect(streamed.length).toBe(whole.length)
    expect(streamed).toEqual(whole)
  })

  it('gives the same audio for text that streams in pieces', async () => {
    const { banks } = fakeBanks()
    const voice = createVoice(banks)
    const english = 'Hello there, would you like to go fishing today?'
    const whole = join(await collect(streamSpeech(english, voice, { sampleRate, seed: 3 })))
    // The pieces split words; the splitter waits for the rest of each word.
    const split = join(await collect(streamSpeech(pieces(['Hel', 'lo th', 'ere, wou', 'ld you like to go fish', 'ing today?']), voice, { sampleRate, seed: 3 })))
    expect(split.subarray(0, whole.length)).toEqual(whole)
    // Live input cannot know the text has ended, so it also plays the final pause.
    expect(split.subarray(whole.length).every(sample => sample === 0)).toBe(true)
  })

  it('marks every token in order, with offsets into the input', async () => {
    const { banks } = fakeBanks()
    const chunks = await collect(streamSpeech(text, createVoice(banks), { sampleRate }))
    const marks = chunks.flatMap(chunk => chunk.marks)
    expect(marks.map(mark => mark.token)).toEqual(marks.map((_, index) => index))
    expect(marks.map(mark => text.slice(mark.start, mark.end)).join('')).toBe(text)
    for (const chunk of chunks) {
      for (const mark of chunk.marks)
        expect(mark.time).toBeGreaterThanOrEqual(chunk.time - 1e-9)
    }
  })

  it('speaks a quiet live sentence before more text arrives', async () => {
    const { banks } = fakeBanks()
    const reader = streamSpeech(pieces(['你好呀', '再见'], 300), createVoice(banks), { sampleRate, idleMs: 50 }).getReader()
    const started = Date.now()
    const first = await reader.read()
    // The idle flush lets the first piece play while the second is still 300 ms away.
    expect(first.done).toBe(false)
    expect(Date.now() - started).toBeLessThan(600)
    await reader.cancel()
  })

  it('loads only the banks the text needs, from the voice chosen by pitch', async () => {
    const { banks, loads } = fakeBanks()
    await collect(streamSpeech('你好', createVoice(banks, { preset: 'cranky' }), { sampleRate, chinese: 'syllables' }))
    expect(loads).toEqual(['zh-onyx'])
  })

  it('voices Chinese with the Japanese kana bank by default', async () => {
    const { banks, loads } = fakeBanks()
    await collect(streamSpeech('你好', createVoice(banks), { sampleRate }))
    expect(loads).toEqual(['ja-nova'])
  })

  it('treats Han characters as Japanese once the stream has hiragana', async () => {
    const { banks, loads } = fakeBanks()
    await collect(streamSpeech(pieces(['今日は', '天気']), createVoice(banks), { sampleRate }))
    expect(loads).toEqual(['ja-nova'])
  })
})

describe('generateSpeech', () => {
  it('writes the whole speech as a WAV file', async () => {
    const { banks } = fakeBanks()
    const voice = createVoice(banks)
    const wav = await generateSpeech(text, voice, { sampleRate })
    const decoded = decodeWav(wav)
    expect(decoded.sampleRate).toBe(sampleRate)
    expect(decoded.samples.length).toBe(join(await collect(streamSpeech(text, voice, { sampleRate }))).length)
  })
})

describe('planSpeech', () => {
  it('plans without audio and reports the bank and missing languages', () => {
    const { banks, loads } = fakeBanks()
    const plan = planSpeech('Hello 你好', createVoice(banks, { preset: 'cranky' }), { chinese: 'syllables' })
    expect(plan.bank).toBe('onyx')
    expect(plan.languages.sort()).toEqual(['ja', 'zh'])
    expect(plan.missing).toEqual(['ja'])
    expect(plan.schedule.events.some(event => event.type === 'unit')).toBe(true)
    expect(loads).toEqual([])
  })
})
