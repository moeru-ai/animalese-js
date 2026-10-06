import type { Playback, SpeechInput, SpeechOptions, Voice } from 'animalese'

import { errorMessageFrom } from '@moeru/std'
import { playSpeech, streamSpeech } from 'animalese'
import { useRef, useState } from 'react'

import { useAnimalese } from './animalese'

export interface Speech {
  /** Speaks text, or text that streams in, and resolves when playback ends. */
  say: (input: SpeechInput, voice: Voice, options?: SpeechOptions) => Promise<void>
  stop: () => void
  /** Characters revealed so far while speaking, `null` when idle. */
  revealed: number | null
  /** Token being revealed, -1 when idle. */
  active: number
  playing: boolean
  error: string
}

/** Speaks through the shared audio context and tracks the reveal, for any page with a dialogue box. */
export function useSpeech(): Speech {
  const { audioContext } = useAnimalese()
  const [revealed, setRevealed] = useState<number | null>(null)
  const [active, setActive] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const playbackRef = useRef<Playback | null>(null)

  const stop = () => playbackRef.current?.stop()

  const say = async (input: SpeechInput, voice: Voice, options: SpeechOptions = {}) => {
    stop()
    setError('')
    setRevealed(0)
    setPlaying(true)
    const playback = playSpeech(streamSpeech(input, voice, options), {
      context: audioContext(),
      onMark: (mark) => {
        setActive(mark.token)
        setRevealed(mark.end)
      },
    })
    playbackRef.current = playback
    try {
      await playback.finished
    }
    catch (cause) {
      setError(errorMessageFrom(cause) ?? String(cause))
    }
    finally {
      if (playbackRef.current === playback) {
        playbackRef.current = null
        setPlaying(false)
        setRevealed(null)
        setActive(-1)
      }
    }
  }

  return { say, stop, revealed, active, playing, error }
}
