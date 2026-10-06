import type { BankIndexEntry, BankManifest, LanguageCode } from '@animalese/core'
import type { PcmBank } from '@animalese/dsp'

import { frontends } from '@animalese/g2p'

import { createBanks } from '../src/index.ts'

export const sampleRate = 24000

/** A bank where every unit of the language is the same short sine at the reference pitch. */
export function sineBank(language: LanguageCode, voice: string, referenceHz: number): PcmBank {
  const samples = Float32Array.from({ length: sampleRate * 0.15 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * referenceHz * i / sampleRate))
  const units = Object.fromEntries(frontends[language].inventory.map(unit => [unit.id, { offset: 0, length: samples.length, f0: referenceHz }]))
  const manifest: BankManifest = { format: 'animalese-bank@1', id: `${language}-${voice}`, language, voice, source: 'test', sampleRate, referenceHz, sprite: 'sprite.wav', units, createdAt: '' }
  return { manifest, samples }
}

export const pcmBanks = [sineBank('zh', 'nova', 196), sineBank('ja', 'nova', 175), sineBank('zh', 'onyx', 98)]

export const entries: BankIndexEntry[] = pcmBanks.map(({ manifest }) => ({
  id: manifest.id,
  language: manifest.language,
  voice: manifest.voice,
  source: manifest.source,
  referenceHz: manifest.referenceHz,
  units: Object.keys(manifest.units).length,
  manifest: `${manifest.id}/manifest.json`,
}))

export function fakeBanks() {
  const loads: string[] = []
  const banks = createBanks(entries, async (entry) => {
    loads.push(entry.id)
    return pcmBanks.find(bank => bank.manifest.id === entry.id)!
  })
  return { banks, loads }
}

/** Collects a speech stream into its chunks. */
export async function collect<T>(stream: ReadableStream<T>): Promise<T[]> {
  const chunks: T[] = []
  const reader = stream.getReader()
  for (let read = await reader.read(); !read.done; read = await reader.read())
    chunks.push(read.value)
  return chunks
}

export function join(chunks: { samples: Float32Array }[]): Float32Array {
  const output = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.samples.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk.samples, offset)
    offset += chunk.samples.length
  }
  return output
}

/** Text that arrives in pieces, with an optional delay before each one. */
export async function* pieces(parts: string[], delayMs = 0): AsyncGenerator<string> {
  for (const part of parts) {
    if (delayMs > 0)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    yield part
  }
}
