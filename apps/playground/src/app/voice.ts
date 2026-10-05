import type { VoiceInput, VoiceOptions, VoicePreset } from 'animalese'

import { resolveVoice } from 'animalese'
import { useMemo, useState } from 'react'

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
  voice: VoiceInput
}

export function useVoiceState(initial: VoicePreset = 'normal'): VoiceState {
  const [state, setState] = useState(() => ({ preset: initial, knobs: knobsOf(initial) }))
  const voice = useMemo<VoiceInput>(() => ({ preset: state.preset, ...state.knobs }), [state])
  return {
    ...state,
    voice,
    setPreset: preset => setState({ preset, knobs: knobsOf(preset) }),
    setKnobs: patch => setState(current => ({ ...current, knobs: { ...current.knobs, ...patch } })),
  }
}
