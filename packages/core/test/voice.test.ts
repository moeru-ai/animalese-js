import { describe, expect, it } from 'vitest'

import { defaultVoice, resolveVoice, voicePresets } from '../src/index.ts'

describe('resolveVoice', () => {
  it('returns the defaults when given nothing', () => {
    expect(resolveVoice()).toEqual(defaultVoice)
  })

  it('applies the preset, then the overrides', () => {
    const voice = resolveVoice({ preset: 'cranky', speed: 7 })
    expect(voice.baseHz).toBe(voicePresets.cranky.baseHz)
    expect(voice.speed).toBe(7)
    expect(voice.textRate).toBe(voicePresets.cranky.textRate)
  })

  it('merges pauses instead of replacing them', () => {
    const voice = resolveVoice({ pauses: { comma: 1 } })
    expect(voice.pauses.comma).toBe(1)
    expect(voice.pauses.period).toBe(defaultVoice.pauses.period)
  })

  it('accepts a full voice unchanged', () => {
    const voice = resolveVoice({ preset: 'peppy', seed: 3 })
    expect(resolveVoice(voice)).toEqual(voice)
  })

  it('does not share the pauses object with the defaults', () => {
    resolveVoice().pauses.comma = 99
    expect(defaultVoice.pauses.comma).not.toBe(99)
  })
})
