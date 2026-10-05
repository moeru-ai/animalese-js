import type { LanguageCode, Schedule, Token, VoiceInput, VoiceOptions } from '@animalese/core'
import type { AnalyzeOptions } from '@animalese/g2p'
import type { BankLibraryOptions, Playback, PlayOptions } from '@animalese/web'

import { bankLanguages, resolveVoice, schedule } from '@animalese/core'
import { analyze } from '@animalese/g2p'
import { BankLibrary, play, renderWav } from '@animalese/web'

export * from '@animalese/core'
export { analyze, detectLanguage, frontends } from '@animalese/g2p'
export type { AnalyzeOptions } from '@animalese/g2p'
export { BankLibrary, loadBank, loadBankIndex, play, render, renderWav } from '@animalese/web'
export type { BankSet, LoadedBank, Playback, PlayOptions } from '@animalese/web'

export interface SpeechOptions extends AnalyzeOptions {
  /** Voice settings, e.g. `{ preset: 'cranky' }` or `{ baseHz: 300, speed: 9 }`. */
  voice?: VoiceInput
  /** Which recorded voice to use. Defaults to the one recorded closest to the voice's pitch. */
  bank?: string
}

/** Everything decided before any audio is touched. */
export interface Plan {
  text: string
  tokens: Token[]
  voice: VoiceOptions
  /** Recorded voice the banks are taken from. */
  bank: string | undefined
  /** Bank languages the text needs. */
  languages: LanguageCode[]
  /** Needed languages the chosen voice has no bank for; those units stay silent. */
  missing: LanguageCode[]
  schedule: Schedule
}

export interface AnimaleseOptions extends BankLibraryOptions {
  /** URL of a bank directory's `index.json`, or a ready library. */
  banks: string | URL | BankLibrary
  /** Context to play in. By default one is created on first `say`, which should follow a user gesture. */
  audioContext?: AudioContext
}

export interface Animalese {
  readonly library: BankLibrary
  /** Analyzes and schedules text without loading or playing anything. */
  plan: (text: string, options?: SpeechOptions) => Plan
  /** Speaks text; resolves once playback has started. */
  say: (text: string, options?: SpeechOptions & PlayOptions) => Promise<Playback & { plan: Plan }>
  /** Renders text to a WAV file. */
  render: (text: string, options?: SpeechOptions) => Promise<Blob>
  /** The playback context, created and resumed on demand. */
  audioContext: () => AudioContext
}

/**
 * One object for the common case:
 *
 * ```ts
 * const animalese = await createAnimalese({ banks: '/banks/index.json' })
 * button.onclick = () => animalese.say('你好呀！', { voice: { preset: 'peppy' } })
 * ```
 */
export async function createAnimalese(options: AnimaleseOptions): Promise<Animalese> {
  const { banks, audioContext: givenContext, ...libraryOptions } = options
  const library = banks instanceof BankLibrary ? banks : await BankLibrary.fromIndex(banks, libraryOptions)
  let context = givenContext

  const audioContext = (): AudioContext => {
    context ??= new AudioContext()
    if (context.state === 'suspended')
      void context.resume()
    return context
  }

  const plan = (text: string, speech: SpeechOptions = {}): Plan => {
    const voice = resolveVoice(speech.voice)
    const tokens = analyze(text, speech)
    const languages = [...bankLanguages(tokens)]
    const bank = speech.bank ?? library.voiceFor(voice.baseHz)
    return {
      text,
      tokens,
      voice,
      bank,
      languages,
      missing: bank ? library.missing(bank, languages) : languages,
      schedule: schedule(tokens, voice),
    }
  }

  const banksFor = async (planned: Plan) => planned.bank ? library.load(planned.bank, planned.languages) : {}

  return {
    library,
    plan,
    audioContext,
    async say(text, speech = {}) {
      const planned = plan(text, speech)
      const playback = play(audioContext(), await banksFor(planned), planned.schedule, speech)
      return { ...playback, plan: planned }
    },
    async render(text, speech = {}) {
      const planned = plan(text, speech)
      return renderWav(await banksFor(planned), planned.schedule)
    },
  }
}
