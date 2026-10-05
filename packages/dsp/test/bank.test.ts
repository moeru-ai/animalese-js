import type { BankManifest } from '@animalese/core'

import { describe, expect, it } from 'vitest'

import { bankResolver, decodeBank, decodeWav, encodeWav, packSprite } from '../src/index.ts'

const rate = 24000
const tone = (length: number, value: number) => new Float32Array(length).fill(value)

function bank(language: 'zh' | 'ja') {
  const sprite = packSprite([{ id: `${language}/a`, samples: tone(100, 0.5), f0: 200 }, { id: `${language}/i`, samples: tone(50, -0.5), f0: null }], rate)
  const manifest: BankManifest = { format: 'animalese-bank@1', id: `${language}-test`, language, voice: 'test', source: 'test', sampleRate: rate, referenceHz: 200, sprite: 'sprite.wav', units: sprite.units, createdAt: '' }
  return { manifest, wav: encodeWav({ samples: sprite.samples, sampleRate: rate }) }
}

describe('packSprite', () => {
  it('lays units out in order with gaps', () => {
    const { units } = packSprite([{ id: 'a', samples: tone(10, 1), f0: 100 }, { id: 'b', samples: tone(5, 1), f0: null }], 1000, 3)
    expect(units).toEqual({ a: { offset: 0, length: 10, f0: 100 }, b: { offset: 13, length: 5, f0: null } })
  })
})

describe('decodeBank', () => {
  it('decodes the sprite of a manifest', () => {
    const { manifest, wav } = bank('zh')
    expect(decodeBank(manifest, wav).samples.length).toBe(100 + 50 + 2 * rate * 0.02)
  })

  it('rejects a sprite at the wrong sample rate', () => {
    const { manifest, wav } = bank('zh')
    expect(() => decodeBank({ ...manifest, sampleRate: 48000 }, wav)).toThrow(/24000/)
  })
})

describe('bankResolver', () => {
  it('finds units by their bank language', () => {
    const zh = bank('zh')
    const ja = bank('ja')
    const resolve = bankResolver([decodeBank(zh.manifest, zh.wav), decodeBank(ja.manifest, ja.wav)])
    const unit = resolve('ja/i')!
    expect(unit.samples.length).toBe(50)
    expect(unit.samples[0]).toBeCloseTo(-0.5, 3)
    expect(unit.referenceHz).toBe(200)
  })

  it('returns undefined for unknown units and languages', () => {
    const zh = bank('zh')
    const resolve = bankResolver([decodeBank(zh.manifest, zh.wav)])
    expect(resolve('zh/nope')).toBeUndefined()
    expect(resolve('ko/가')).toBeUndefined()
  })
})

describe('decodeWav formats', () => {
  function wav(format: number, bits: number, channels: number, frames: number[][]): Uint8Array {
    const bytesPerSample = bits / 8
    const data = new DataView(new ArrayBuffer(frames.length * channels * bytesPerSample))
    frames.flat().forEach((value, index) => {
      const at = index * bytesPerSample
      if (format === 3)
        data.setFloat32(at, value, true)
      else if (bits === 24)
        [0, 1, 2].forEach(byte => data.setUint8(at + byte, (Math.round(value * 8388607) >> (8 * byte)) & 0xFF))
    })
    const header = new DataView(new ArrayBuffer(44))
    const text = (at: number, value: string) => [...value].forEach((char, i) => header.setUint8(at + i, char.charCodeAt(0)))
    text(0, 'RIFF')
    header.setUint32(4, 36 + data.byteLength, true)
    text(8, 'WAVE')
    text(12, 'fmt ')
    header.setUint32(16, 16, true)
    header.setUint16(20, format, true)
    header.setUint16(22, channels, true)
    header.setUint32(24, 8000, true)
    header.setUint32(28, 8000 * channels * bytesPerSample, true)
    header.setUint16(32, channels * bytesPerSample, true)
    header.setUint16(34, bits, true)
    text(36, 'data')
    header.setUint32(40, data.byteLength, true)
    const bytes = new Uint8Array(44 + data.byteLength)
    bytes.set(new Uint8Array(header.buffer), 0)
    bytes.set(new Uint8Array(data.buffer), 44)
    return bytes
  }

  it('reads 32-bit float', () => {
    expect([...decodeWav(wav(3, 32, 1, [[0.25], [-0.75]])).samples]).toEqual([0.25, -0.75])
  })

  it('reads 24-bit PCM', () => {
    const { samples } = decodeWav(wav(1, 24, 1, [[0.5], [-0.5]]))
    expect(samples[0]).toBeCloseTo(0.5, 5)
    expect(samples[1]).toBeCloseTo(-0.5, 5)
  })

  it('mixes stereo down to mono', () => {
    expect([...decodeWav(wav(3, 32, 2, [[1, 0], [0.5, -0.5]])).samples]).toEqual([0.5, 0])
  })

  it('rejects files that are not WAV', () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(/RIFF/)
  })
})
