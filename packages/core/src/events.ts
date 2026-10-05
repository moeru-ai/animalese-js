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
