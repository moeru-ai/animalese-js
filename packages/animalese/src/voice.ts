import type { VoiceOptions, VoiceSource } from '@animalese/core'

import type { Banks } from './banks.ts'

import { resolveVoice } from '@animalese/core'

/** Voice settings together with the banks that voice them. */
export interface Voice {
  readonly banks: Banks
  /** What the scheduler reads; a function is read again before each step. */
  readonly source: VoiceSource
  /** The current full settings. */
  readonly options: VoiceOptions
  /** The recorded voice in use: the given one, or the one recorded closest to `options.baseHz`. */
  readonly bank: string | undefined
}

export interface CreateVoiceOptions {
  /** Use this recorded voice instead of choosing by pitch. */
  bank?: string
}

/**
 * Creates a voice from settings, for example `{ preset: 'peppy' }`. Pass a function, such
 * as an alien-signals `computed`, to change the voice while it speaks.
 */
export function createVoice(banks: Banks, source: VoiceSource = {}, options: CreateVoiceOptions = {}): Voice {
  const read = (): VoiceOptions => resolveVoice(typeof source === 'function' ? source() : source)
  return {
    banks,
    source,
    get options() {
      return read()
    },
    get bank() {
      return options.bank ?? banks.voiceFor(read().baseHz)
    },
  }
}
