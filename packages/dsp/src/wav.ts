export interface PcmAudio {
  sampleRate: number
  /** Mono samples in [-1, 1]. */
  samples: Float32Array
}

function readString(view: DataView, offset: number, length: number): string {
  let text = ''
  for (let i = 0; i < length; i++)
    text += String.fromCharCode(view.getUint8(offset + i))
  return text
}

/** Decodes a PCM (8/16/24/32-bit) or IEEE float WAV file and mixes it down to mono. */
export function decodeWav(data: ArrayBuffer | Uint8Array): PcmAudio {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readString(view, 0, 4) !== 'RIFF' || readString(view, 8, 4) !== 'WAVE')
    throw new Error('not a RIFF/WAVE file')

  let format = 0
  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const id = readString(view, offset, 4)
    // Streaming encoders (including some TTS APIs) write 0xFFFFFFFF for unknown sizes.
    let size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
      // WAVE_FORMAT_EXTENSIBLE keeps the real format in the sub-format GUID.
      if (format === 0xFFFE)
        format = view.getUint16(body + 24, true)
    }
    else if (id === 'data') {
      if (!channels)
        throw new Error('data chunk before fmt chunk')
      size = Math.min(size, view.byteLength - body)
      const bytesPerSample = bitsPerSample / 8
      const frames = Math.floor(size / (bytesPerSample * channels))
      const samples = new Float32Array(frames)
      const read = sampleReader(view, format, bitsPerSample)
      for (let frame = 0; frame < frames; frame++) {
        let sum = 0
        for (let channel = 0; channel < channels; channel++)
          sum += read(body + (frame * channels + channel) * bytesPerSample)
        samples[frame] = sum / channels
      }
      return { sampleRate, samples }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('no data chunk')
}

function sampleReader(view: DataView, format: number, bits: number): (offset: number) => number {
  if (format === 3 && bits === 32)
    return offset => view.getFloat32(offset, true)
  if (format !== 1)
    throw new Error(`unsupported WAV format ${format}`)
  switch (bits) {
    case 8: return offset => (view.getUint8(offset) - 128) / 128
    case 16: return offset => view.getInt16(offset, true) / 32768
    case 24: return offset => ((view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getInt8(offset + 2) << 16))) / 8388608
    case 32: return offset => view.getInt32(offset, true) / 2147483648
    default: throw new Error(`unsupported bit depth ${bits}`)
  }
}

/** Encodes mono samples as a 16-bit PCM WAV file. */
export function encodeWav({ samples, sampleRate }: PcmAudio): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const writeString = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true)
  }
  return bytes
}
