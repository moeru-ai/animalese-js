import { vi } from 'vitest'

/** A test double that implements only what the code under test touches. */
export function stub<T>(partial: Partial<T>): T {
  return partial as T
}

// Only the node-to-node overload is used, which returns its argument for chaining.
const connect = ((next: AudioNode) => next) as AudioNode['connect']

export interface FakeSource {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  length: number
  sampleRate: number
}

/** Just enough of an AudioContext for the player; tests drive `currentTime` by hand. */
export function fakeAudioContext() {
  const sources: FakeSource[] = []
  const clock = { currentTime: 0 }
  const mediaStream = stub<MediaStream>({ id: 'fake-stream' })
  const context = stub<AudioContext>({
    get currentTime() {
      return clock.currentTime
    },
    state: 'running',
    destination: stub<AudioDestinationNode>({ connect }),
    createBuffer: (_channels: number, length: number, sampleRate: number) => stub<AudioBuffer>({ length, sampleRate, copyToChannel: vi.fn() }),
    createBufferSource: () => {
      const node = { start: vi.fn(), stop: vi.fn(), length: 0, sampleRate: 0 }
      sources.push(node)
      const source = stub<AudioBufferSourceNode>({ connect, start: node.start, stop: node.stop })
      // Record the buffer when the player assigns it.
      return Object.defineProperty(source, 'buffer', {
        get: () => null,
        set: (buffer: AudioBuffer) => {
          node.length = buffer.length
          node.sampleRate = buffer.sampleRate
        },
      })
    },
    createMediaStreamDestination: () => stub<MediaStreamAudioDestinationNode>({ connect, stream: mediaStream }),
  })
  return { context, clock, sources, mediaStream }
}
