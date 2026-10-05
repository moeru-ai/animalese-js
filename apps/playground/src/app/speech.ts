import type { Playback, SpeechOptions } from 'animalese'

import { errorMessageFrom } from '@moeru/std'
import { useRef, useState } from 'react'

import { useAnimalese } from './animalese'

export interface Speech {
  say: (text: string, options: SpeechOptions) => Promise<void>
  stop: () => void
  /** Characters revealed so far while speaking, `null` when idle. */
  revealed: number | null
  /** Token being revealed or voiced, -1 when idle. */
  active: number
  busy: boolean
  error: string
}

/** Speaks text and tracks the reveal, for any page with a dialogue box. */
export function useSpeech(): Speech {
  const { animalese } = useAnimalese()
  const [revealed, setRevealed] = useState<number | null>(null)
  const [active, setActive] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const playbackRef = useRef<Playback | null>(null)

  const stop = () => playbackRef.current?.stop()

  const say = async (text: string, options: SpeechOptions) => {
    if (!animalese)
      return
    stop()
    setError('')
    setBusy(true)
    setRevealed(0)
    try {
      // Same text and options give the same plan `say` will use, so its tokens map events to text.
      const { tokens } = animalese.plan(text, options)
      const playback = await animalese.say(text, {
        ...options,
        onEvent: (event) => {
          setActive(event.token)
          setRevealed(tokens[event.token]!.end)
        },
      })
      playbackRef.current = playback
      setBusy(false)
      await playback.finished
    }
    catch (cause) {
      setError(errorMessageFrom(cause) ?? String(cause))
    }
    finally {
      setBusy(false)
      setRevealed(null)
      setActive(-1)
    }
  }

  return { say, stop, revealed, active, busy, error }
}
