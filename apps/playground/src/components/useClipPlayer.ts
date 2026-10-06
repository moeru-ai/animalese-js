import { useCallback } from 'react'

import { useAnimalese } from '../app/animalese'

/** Plays raw mono samples through the shared audio context, optionally faster or slower. */
export function useClipPlayer(): (samples: Float32Array, sampleRate: number, rate?: number) => void {
  const { audioContext } = useAnimalese()
  return useCallback((samples, sampleRate, rate = 1) => {
    if (samples.length === 0)
      return
    const context = audioContext()
    const buffer = context.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    source.connect(context.destination)
    source.start()
  }, [audioContext])
}
