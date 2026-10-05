import type { Recorder } from '../src/index.ts'

import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { decodeWav } from '@animalese/dsp'
import { ja } from '@animalese/g2p'
import { describe, expect, it } from 'vitest'

import { bakeBank, cachedRecorder, readBank } from '../src/index.ts'

/** A fake TTS: every unit is a sine whose pitch depends on the carrier, with silence around it. */
function sineRecorder(calls: string[]): Recorder {
  return {
    source: 'test:sine:voice',
    fingerprint: unit => unit.carrier,
    async record(unit) {
      calls.push(unit.id)
      const sampleRate = 22050
      const hz = 180 + (unit.carrier.codePointAt(0)! % 40)
      const samples = new Float32Array(sampleRate * 0.6)
      for (let i = sampleRate * 0.1; i < sampleRate * 0.5; i++)
        samples[i] = 0.4 * Math.sin(2 * Math.PI * hz * i / sampleRate)
      return { sampleRate, samples }
    },
  }
}

describe('bakeBank', () => {
  it('writes a sprite, a manifest and an index', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'animalese-bake-'))
    const only = ['ja/a', 'ja/ka', 'ja/sa', 'ja/kyo']
    const manifest = await bakeBank({ frontend: ja, recorder: sineRecorder([]), outDir, only, prepare: { maxMs: 200 } })

    expect(manifest.id).toBe('ja-voice')
    expect(Object.keys(manifest.units)).toEqual(only)
    // The reference is the median unit pitch, snapped to an equal-tempered note.
    const semitones = 12 * Math.log2(manifest.referenceHz / 440)
    expect(semitones).toBeCloseTo(Math.round(semitones), 2)
    for (const unit of Object.values(manifest.units))
      expect(unit.length).toBeLessThanOrEqual(24000 * 0.2)

    const sprite = decodeWav(await readFile(join(outDir, 'ja-voice', 'sprite.wav')))
    expect(sprite.sampleRate).toBe(24000)
    const index = JSON.parse(await readFile(join(outDir, 'index.json'), 'utf8'))
    expect(index).toEqual([expect.objectContaining({ id: 'ja-voice', language: 'ja', units: 4, manifest: 'ja-voice/manifest.json' })])
    expect((await readBank(join(outDir, 'ja-voice'))).samples.length).toBe(sprite.samples.length)
  })

  it('reuses cached recordings', async () => {
    const cache = await mkdtemp(join(tmpdir(), 'animalese-cache-'))
    const calls: string[] = []
    const recorder = cachedRecorder(sineRecorder(calls), cache)
    const outDir = await mkdtemp(join(tmpdir(), 'animalese-bake-'))
    await bakeBank({ frontend: ja, recorder, outDir, only: ['ja/a', 'ja/i'] })
    await bakeBank({ frontend: ja, recorder, outDir, only: ['ja/a', 'ja/i'] })
    // Recordings run concurrently, so only the set of calls is stable.
    expect(calls.toSorted()).toEqual(['ja/a', 'ja/i'])
    expect(await readdir(cache)).toHaveLength(2)
  })
})
