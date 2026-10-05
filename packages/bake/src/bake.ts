import type { BankIndexEntry, BankManifest, UnitDefinition } from '@animalese/core'
import type { PcmBank, PrepareOptions } from '@animalese/dsp'
import type { Frontend } from '@animalese/g2p'

import type { Recorder } from './recorder.ts'

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { convertSampleRate, decodeBank, encodeWav, measureUnit, packSprite, prepareUnit, snapToSemitone } from '@animalese/dsp'

export interface BakeOptions {
  frontend: Frontend
  recorder: Recorder
  /** Directory that holds one sub-directory per bank. */
  outDir: string
  /** Bank id; defaults to `<language>-<voice>`. */
  id?: string
  /** Label shown to users; defaults to the recorder source. */
  voice?: string
  /** Only bake these unit ids (useful for quick tests). */
  only?: string[]
  sampleRate?: number
  concurrency?: number
  /** Overrides the automatic reference pitch (the median f0 of the bank, snapped to a semitone). */
  referenceHz?: number
  prepare?: Omit<PrepareOptions, 'referenceHz'>
  onProgress?: (done: number, total: number, unit: UnitDefinition) => void
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

function median(values: number[]): number | undefined {
  if (!values.length)
    return undefined
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Records every unit of a language inventory, preprocesses it and writes a voice bank:
 *
 *   <outDir>/<id>/manifest.json
 *   <outDir>/<id>/sprite.wav
 *
 * and refreshes `<outDir>/index.json` so players can list the available banks.
 */
export async function bakeBank(options: BakeOptions): Promise<BankManifest> {
  const { frontend, recorder, outDir, sampleRate = 24000, concurrency = 6, prepare = {} } = options
  const voiceName = recorder.source.split(':').at(-1) ?? 'voice'
  const id = options.id ?? `${frontend.language}-${voiceName}`
  const units = options.only
    ? frontend.inventory.filter(unit => options.only!.includes(unit.id))
    : frontend.inventory

  let done = 0
  const measured = await mapWithConcurrency(units, concurrency, async (unit) => {
    const recording = await recorder.record(unit, frontend.language)
    const samples = convertSampleRate(recording.samples, recording.sampleRate, sampleRate)
    const result = measureUnit(samples, sampleRate, prepare)
    options.onProgress?.(++done, units.length, unit)
    return result
  })

  const referenceHz = options.referenceHz
    ?? snapToSemitone(median(measured.flatMap(unit => unit.f0 ?? [])) ?? 220)
  const prepared = measured.map((unit, index) => ({
    id: units[index]!.id,
    ...prepareUnit(unit, sampleRate, { ...prepare, referenceHz }),
  }))

  const sprite = packSprite(prepared, sampleRate)
  const manifest: BankManifest = {
    format: 'animalese-bank@1',
    id,
    language: frontend.language,
    voice: options.voice ?? voiceName,
    source: recorder.source,
    sampleRate,
    referenceHz: Math.round(referenceHz * 100) / 100,
    sprite: 'sprite.wav',
    units: sprite.units,
    createdAt: new Date().toISOString(),
  }

  const directory = join(outDir, id)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'sprite.wav'), encodeWav({ samples: sprite.samples, sampleRate }))
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeBankIndex(outDir)
  return manifest
}

/** Lists every bank under `outDir` in `<outDir>/index.json`. */
export async function writeBankIndex(outDir: string): Promise<BankIndexEntry[]> {
  const entries: BankIndexEntry[] = []
  for (const entry of await readdir(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    try {
      const manifest = JSON.parse(await readFile(join(outDir, entry.name, 'manifest.json'), 'utf8')) as BankManifest
      entries.push({
        id: manifest.id,
        language: manifest.language,
        voice: manifest.voice,
        source: manifest.source,
        referenceHz: manifest.referenceHz,
        units: Object.keys(manifest.units).length,
        manifest: `${entry.name}/manifest.json`,
      })
    }
    catch {}
  }
  entries.sort((a, b) => a.id.localeCompare(b.id))
  await writeFile(join(outDir, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`)
  return entries
}

/** Reads a baked bank directory into memory, for rendering in Node with `renderSchedule`. */
export async function readBank(directory: string): Promise<PcmBank> {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as BankManifest
  return decodeBank(manifest, await readFile(join(directory, manifest.sprite)))
}
