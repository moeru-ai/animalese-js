/** The parts of the Web Speech API `SpeechRecognition` this module uses. */
export interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
}

interface ResultEvent extends Event {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

/**
 * Streams the final transcripts of a speech recognizer as text, for `streamSpeech`.
 * Interim results are skipped: they change as the recognizer listens, and speech that has
 * played cannot be taken back. The stream ends when recognition ends.
 */
export function textStreamFromSpeechRecognition(recognition: SpeechRecognitionLike): ReadableStream<string> {
  let onResult: (event: Event) => void
  let onEnd: () => void
  return new ReadableStream<string>({
    start(controller) {
      onResult = (event) => {
        const { resultIndex, results } = event as ResultEvent
        for (let i = resultIndex; i < results.length; i++) {
          const result = results[i]!
          if (result.isFinal && result[0]?.transcript)
            controller.enqueue(result[0].transcript)
        }
      }
      onEnd = () => {
        recognition.removeEventListener('result', onResult)
        controller.close()
      }
      recognition.addEventListener('result', onResult)
      recognition.addEventListener('end', onEnd, { once: true })
    },
    cancel() {
      recognition.removeEventListener('result', onResult)
      recognition.removeEventListener('end', onEnd)
      recognition.stop()
    },
  })
}
