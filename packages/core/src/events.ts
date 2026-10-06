/** Play one unit. */
export interface UnitEvent {
  type: 'unit'
  unit: string
  /** Onset in seconds from the start of the utterance. */
  time: number
  /** Target fundamental frequency. Players divide by the bank's `referenceHz` to get a playback rate. */
  hz: number
  /** Pitch bend over the unit, in semitones (negative falls). */
  glide: number
  gain: number
  /** Playback is cut (with a short release) after this many seconds. */
  maxDuration: number
  /** Index into the token list. */
  token: number
}

/** A token is revealed at `time`. Every token gets one, voiced or not, to drive the text reveal. */
export interface MarkEvent {
  type: 'mark'
  time: number
  token: number
}

export type SpeechEvent = UnitEvent | MarkEvent

/** Timed events for one utterance, sorted by time. */
export interface Schedule {
  events: SpeechEvent[]
  /** Seconds until the last unit stops ringing. */
  duration: number
}

/** A token of the input text appears at `time`, for text reveal in sync with the audio. */
export interface SpeechMark {
  time: number
  /** Index of the token among all tokens of the speech. */
  token: number
  text: string
  /** Offsets (UTF-16) in the whole input text. */
  start: number
  end: number
}

/** One piece of streamed speech audio. */
export interface SpeechChunk {
  /** Mono samples in [-1, 1]. */
  samples: Float32Array
  sampleRate: number
  /** Seconds from the start of the speech to the first sample. */
  time: number
  /** Tokens that appear while this chunk plays, in order. */
  marks: SpeechMark[]
}
