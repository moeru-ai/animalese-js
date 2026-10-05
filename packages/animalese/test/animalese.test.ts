import type { BankIndexEntry } from '@animalese/core'

import { describe, expect, it } from 'vitest'

import { fakeAudioContext, fakeServer } from '../../web/test/fakes.ts'
import { BankLibrary, createAnimalese } from '../src/index.ts'

function entry(language: 'zh' | 'ja', voice: string, referenceHz: number): BankIndexEntry {
  return { id: `${language}-${voice}`, language, voice, source: 'test', referenceHz, units: 1, manifest: `${language}-${voice}/manifest.json` }
}

const entries = [entry('zh', 'nova', 196), entry('ja', 'nova', 175), entry('zh', 'onyx', 98)]

async function setup() {
  return createAnimalese({ banks: new BankLibrary(entries, 'https://example.test/banks/index.json') })
}

describe('plan', () => {
  it('analyzes, schedules and picks a bank without touching audio', async () => {
    const animalese = await setup()
    const plan = animalese.plan('你好！')
    expect(plan.tokens.filter(token => token.kind === 'unit')).toHaveLength(2)
    expect(plan.schedule.events.some(event => event.type === 'unit')).toBe(true)
    expect(plan.languages).toEqual(['zh'])
    expect(plan.missing).toEqual([])
  })

  it('chooses the recording closest to the voice pitch', async () => {
    const animalese = await setup()
    expect(animalese.plan('你好', { voice: { preset: 'cranky' } }).bank).toBe('onyx')
    expect(animalese.plan('你好', { voice: { preset: 'peppy' } }).bank).toBe('nova')
  })

  it('honours an explicit bank and reports what it lacks', async () => {
    const animalese = await setup()
    const plan = animalese.plan('Hello 你好', { bank: 'onyx' })
    expect(plan.bank).toBe('onyx')
    // English is voiced with the Japanese bank, which onyx does not have here.
    expect(plan.languages.sort()).toEqual(['ja', 'zh'])
    expect(plan.missing).toEqual(['ja'])
  })

  it('passes analysis options through', async () => {
    const animalese = await setup()
    expect(animalese.plan('天気', { language: 'ja' }).languages).toEqual(['ja'])
  })
})

describe('say', () => {
  it('loads the planned banks and plays them', async () => {
    const server = fakeServer(entries)
    const { context } = fakeAudioContext()

    const animalese = await createAnimalese({ banks: new BankLibrary(entries, 'https://example.test/banks/index.json', server), audioContext: context })
    const playback = await animalese.say('你好')
    expect(playback.plan.bank).toBe('nova')
    expect(server.requests).toContain('https://example.test/banks/zh-nova/manifest.json')
    playback.stop()
    await playback.finished
  })
})
