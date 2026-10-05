import type { BankUnit } from '@animalese/core'

export interface SpriteInput {
  id: string
  samples: Float32Array
  f0: number | null
}

export interface Sprite {
  samples: Float32Array
  units: Record<string, BankUnit>
}

/** Concatenates units into one buffer with short silent gaps, so a bank is a single fetch and decode. */
export function packSprite(units: readonly SpriteInput[], sampleRate: number, gapMs = 20): Sprite {
  const gap = Math.round(sampleRate * gapMs / 1000)
  const length = units.reduce((sum, unit) => sum + unit.samples.length + gap, 0)
  const samples = new Float32Array(length)
  const index: Record<string, BankUnit> = {}
  let offset = 0
  for (const unit of units) {
    samples.set(unit.samples, offset)
    index[unit.id] = { offset, length: unit.samples.length, f0: unit.f0 === null ? null : Math.round(unit.f0 * 100) / 100 }
    offset += unit.samples.length + gap
  }
  return { samples, units: index }
}

/** A view of one unit inside a sprite (no copy). */
export function sliceUnit(sprite: Float32Array, unit: BankUnit): Float32Array {
  return sprite.subarray(unit.offset, unit.offset + unit.length)
}
