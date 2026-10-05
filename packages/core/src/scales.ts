export type ScaleName
  = | 'chromatic'
    | 'major'
    | 'minor'
    | 'major-pentatonic'
    | 'minor-pentatonic'
    | 'whole-tone'

/** Scales as semitone offsets within one octave. */
export const scales: Record<ScaleName, readonly number[]> = {
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'whole-tone': [0, 2, 4, 6, 8, 10],
}

/** Semitone offset of a scale degree; degrees can be negative or span several octaves. */
export function degreeToSemitones(scale: readonly number[], degree: number): number {
  const size = scale.length
  const octave = Math.floor(degree / size)
  const index = degree - octave * size
  return octave * 12 + scale[index]!
}

export function semitonesToRate(semitones: number): number {
  return 2 ** (semitones / 12)
}
