import type { SpeechRecognitionLike } from 'animalese'

/** A Web Speech API recognizer with the extra fields the live page reads. */
export interface Recognizer extends SpeechRecognitionLike {
  lang: string
}

/** The browser's speech recognizer, if it has one (Chrome and Safari use a `webkit` prefix). */
export function createRecognizer(lang: string): Recognizer | undefined {
  const scope = globalThis as { SpeechRecognition?: new () => Recognizer, webkitSpeechRecognition?: new () => Recognizer }
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
  if (!Recognition)
    return undefined
  const recognizer = new Recognition()
  recognizer.lang = lang
  recognizer.continuous = true
  recognizer.interimResults = true
  return recognizer
}

export const recognitionAvailable: boolean = 'SpeechRecognition' in globalThis || 'webkitSpeechRecognition' in globalThis

interface ResultEvent extends Event {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

/** Calls `onInterim` with the words the recognizer is still unsure about. */
export function watchInterim(recognizer: Recognizer, onInterim: (text: string) => void): void {
  recognizer.addEventListener('result', (event) => {
    const { resultIndex, results } = event as ResultEvent
    let interim = ''
    for (let i = resultIndex; i < results.length; i++) {
      if (!results[i]!.isFinal)
        interim += results[i]![0]?.transcript ?? ''
    }
    onInterim(interim)
  })
}
