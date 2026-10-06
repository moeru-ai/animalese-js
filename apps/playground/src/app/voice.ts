import type { Banks, Voice, VoiceInput, VoiceOptions, VoicePreset } from 'animalese'

import { createVoice, resolveVoice } from 'animalese'
import { useMemo, useRef, useState } from 'react'

/** The voice settings the UI exposes; everything else comes from the preset. */
export type VoiceKnobs = Pick<VoiceOptions, 'baseHz' | 'textRate' | 'speed' | 'range' | 'liveliness' | 'scale' | 'sustain' | 'glide'>

function knobsOf(preset: VoicePreset): VoiceKnobs {
  const { baseHz, textRate, speed, range, liveliness, scale, sustain, glide } = resolveVoice({ preset })
  return { baseHz, textRate, speed, range, liveliness, scale, sustain, glide }
}

export interface VoiceState {
  preset: VoicePreset
  knobs: VoiceKnobs
  /** Picking a preset resets the knobs to its values. */
  setPreset: (preset: VoicePreset) => void
  setKnobs: (patch: Partial<VoiceKnobs>) => void
  input: VoiceInput
}

export function useVoiceState(initial: VoicePreset = 'normal'): VoiceState {
  const [state, setState] = useState(() => ({ preset: initial, knobs: knobsOf(initial) }))
  const input = useMemo<VoiceInput>(() => ({ preset: state.preset, ...state.knobs }), [state])
  return {
    ...state,
    input,
    setPreset: preset => setState({ preset, knobs: knobsOf(preset) }),
    setKnobs: patch => setState(current => ({ ...current, knobs: { ...current.knobs, ...patch } })),
  }
}

/**
 * A `Voice` that reads the latest settings on every step, so moving a slider changes the
 * speech that is already playing. `bank` of `auto` chooses by pitch.
 */
export function useVoice(banks: Banks | null, input: VoiceInput, bank = 'auto'): Voice | null {
  const latestRef = useRef(input)
  latestRef.current = input
  return useMemo(
    () => banks && createVoice(banks, () => latestRef.current, { bank: bank === 'auto' ? undefined : bank }),
    [banks, bank],
  )
}
