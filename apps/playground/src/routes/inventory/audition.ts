import type { Animalese, LoadedBank } from 'animalese'

import { play } from 'animalese'

/** Plays one unit of a bank on its own, at its reference pitch shifted by `octaves`. */
export function audition(animalese: Animalese, bank: LoadedBank, unit: string, octaves = 0): void {
  if (!bank.manifest.units[unit])
    return
  play(animalese.audioContext(), { [bank.manifest.language]: bank }, {
    events: [{ type: 'unit', unit, time: 0, hz: bank.manifest.referenceHz * 2 ** octaves, glide: 0, gain: 1, maxDuration: 2, token: 0 }],
    duration: 2,
  })
}
