import type { SpeechChunk, SpeechMark } from '@animalese/core'

export interface PlaySpeechOptions {
  /** Defaults to a new `AudioContext`. Create it in a user gesture, or browsers keep it silent. */
  context?: AudioContext
  /** Defaults to `context.destination`. */
  destination?: AudioNode
  /** Called as each token appears, in time with the audio, for example to reveal text. */
  onMark?: (mark: SpeechMark) => void
  /** Delay before the first chunk plays, in seconds, to absorb a slow first chunk. Defaults to 0.05. */
  latency?: number
}

export interface Playback {
  readonly context: AudioContext
  /** Stops the sound and stops reading the stream. */
  stop: () => void
  /** Resolves when the last chunk has played, or after `stop`. */
  finished: Promise<void>
}

/**
 * Plays a speech stream through Web Audio. Chunks are queued back to back on the audio
 * clock. If the stream falls behind, for example while live text is quiet, playback waits
 * and continues when the next chunk arrives.
 */
export function playSpeech(stream: ReadableStream<SpeechChunk>, options: PlaySpeechOptions = {}): Playback {
  const context = options.context ?? new AudioContext()
  const destination = options.destination ?? context.destination
  const latency = options.latency ?? 0.05
  if (context.state === 'suspended')
    void context.resume()

  const reader = stream.getReader()
  const sources: AudioBufferSourceNode[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let next = 0
  let stopped = false

  const later = (seconds: number, callback: () => void): void => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      callback()
    }, Math.max(0, seconds * 1000))
    timers.add(timer)
  }

  const schedule = (chunk: SpeechChunk): void => {
    const start = Math.max(next, context.currentTime + (sources.length === 0 ? latency : 0.02))
    if (chunk.samples.length > 0) {
      const buffer = context.createBuffer(1, chunk.samples.length, chunk.sampleRate)
      buffer.copyToChannel(chunk.samples as Float32Array<ArrayBuffer>, 0)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(destination)
      source.start(start)
      sources.push(source)
    }
    next = start + chunk.samples.length / chunk.sampleRate
    for (const mark of chunk.marks)
      later(start + (mark.time - chunk.time) - context.currentTime, () => options.onMark?.(mark))
  }

  let halt!: () => void
  const halted = new Promise<void>((resolve) => {
    halt = resolve
  })

  const played = (async () => {
    try {
      for (;;) {
        const read = await reader.read()
        // `stop` sets `stopped` while this loop waits for the next chunk.
        if (read.done || stopped)
          break
        schedule(read.value)
      }
    }
    finally {
      reader.releaseLock()
    }
    if (!stopped)
      await new Promise<void>(resolve => later(next - context.currentTime, resolve))
  })()
  // `stop` ends the wait too, even while the last chunk is still playing.
  const finished = Promise.race([played, halted])

  const stop = (): void => {
    stopped = true
    halt()
    void reader.cancel().catch(() => {})
    for (const timer of timers)
      clearTimeout(timer)
    timers.clear()
    for (const source of sources) {
      try {
        source.stop()
      }
      catch {}
    }
  }

  return { context, stop, finished: finished.catch(() => {}) }
}

export interface MediaStreamOptions extends Omit<PlaySpeechOptions, 'destination'> {}

/**
 * Turns a speech stream into a live `MediaStream`, for a `<video>` or `<audio>` element,
 * `MediaRecorder` or WebRTC. Stopping the returned playback stops the stream.
 */
export function toMediaStream(stream: ReadableStream<SpeechChunk>, options: MediaStreamOptions = {}): Playback & { stream: MediaStream } {
  const context = options.context ?? new AudioContext()
  const destination = context.createMediaStreamDestination()
  return { ...playSpeech(stream, { ...options, context, destination }), stream: destination.stream }
}
