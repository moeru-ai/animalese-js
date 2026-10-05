import type { Schedule } from '@animalese/core'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { play } from '../src/index.ts'
import { fakeAudioContext, manifest } from './fakes.ts'

const banks = { zh: { manifest: manifest('zh', 'nova', 200), buffer: {} as AudioBuffer } }
const plan: Schedule = {
  events: [
    { type: 'mark', time: 0, token: 0 },
    { type: 'unit', unit: 'zh/a', time: 0, hz: 400, glide: -1, gain: 1, maxDuration: 0.1, token: 0 },
    { type: 'mark', time: 0.1, token: 1 },
    { type: 'unit', unit: 'zh/missing', time: 0.1, hz: 400, glide: 0, gain: 1, maxDuration: 0.1, token: 1 },
  ],
  duration: 0.2,
}

describe('play', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules known units at the bank-relative rate and offset', () => {
    const { context, sources } = fakeAudioContext()
    play(context, banks, plan)
    // The missing unit is skipped.
    expect(sources).toHaveLength(1)
    // 400 Hz against a 200 Hz reference plays an octave up; the unit starts 0.1 s into the sprite.
    expect(sources[0]!.rates).toHaveBeenCalledWith(2, 0.05)
    expect(sources[0]!.start).toHaveBeenCalledWith(0.05, 0.1, 0.1)
  })

  it('finishes without an onEvent callback', async () => {
    const { context, clock } = fakeAudioContext()
    const playback = play(context, banks, plan)
    clock.currentTime = 1
    // Regression: `onEvent?.(events[next++])` skipped the increment and spun forever here.
    vi.advanceTimersByTime(20)
    await expect(playback.finished).resolves.toBeUndefined()
  })

  it('reports every event in order as its time arrives', async () => {
    const { context, clock } = fakeAudioContext()
    const seen: string[] = []
    const playback = play(context, banks, plan, { onEvent: event => seen.push(`${event.type}${event.token}`) })
    clock.currentTime = 0.1
    vi.advanceTimersByTime(10)
    expect(seen).toEqual(['mark0', 'unit0'])
    clock.currentTime = 1
    vi.advanceTimersByTime(10)
    await playback.finished
    expect(seen).toEqual(['mark0', 'unit0', 'mark1', 'unit1'])
  })

  it('stops every source when stopped early', async () => {
    const { context, sources } = fakeAudioContext()
    const playback = play(context, banks, plan)
    playback.stop()
    await playback.finished
    // Once when scheduled, once on stop.
    expect(sources[0]!.stop).toHaveBeenCalledTimes(2)
  })
})
