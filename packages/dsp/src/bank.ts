import type { BankManifest } from '@animalese/core'
import type { UnitResolver } from './render.ts'

import { unitLanguage } from '@animalese/core'

import { sliceUnit } from './sprite.ts'
import { decodeWav } from './wav.ts'

/** A voice bank decoded into memory, for rendering without Web Audio. */
export interface PcmBank {
  manifest: BankManifest
  samples: Float32Array
}

/** Decodes a bank from its manifest and the bytes of its `sprite.wav`. */
export function decodeBank(manifest: BankManifest, sprite: ArrayBuffer | Uint8Array): PcmBank {
  const { samples, sampleRate } = decodeWav(sprite)
  if (sampleRate !== manifest.sampleRate)
    throw new Error(`sprite is ${sampleRate} Hz but the manifest says ${manifest.sampleRate} Hz`)
  return { manifest, samples }
}

/** Resolves unit ids against banks, one bank per language (the last one given wins). */
export function bankResolver(banks: Iterable<PcmBank>): UnitResolver {
  const byLanguage = new Map([...banks].map(bank => [bank.manifest.language, bank]))
  return (unit) => {
    const bank = byLanguage.get(unitLanguage(unit))
    const entry = bank?.manifest.units[unit]
    if (!bank || !entry)
      return undefined
    return { samples: sliceUnit(bank.samples, entry), sampleRate: bank.manifest.sampleRate, referenceHz: bank.manifest.referenceHz }
  }
}
