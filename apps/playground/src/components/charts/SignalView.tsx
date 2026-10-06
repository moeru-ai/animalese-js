import type { PitchOptions } from '@animalese/dsp'

import { trackPitch } from '@animalese/dsp'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface Region {
  start: number
  end: number
  label: string
}

interface SignalViewProps {
  samples: Float32Array
  sampleRate: number
  /** Draw the YIN pitch track over the waveform. */
  pitch?: PitchOptions
  /** A dashed line at this pitch, e.g. the bank's reference note. */
  referenceHz?: number
  /** Shaded spans (in samples), e.g. what a step cuts away. */
  regions?: readonly Region[]
  /** Fix the time axis so several views line up. Defaults to the signal length. */
  seconds?: number
}

const width = 600
const height = 140
const minHz = 70
const maxHz = 900

const yOfHz = (hz: number): number => height - (Math.log2(hz / minHz) / Math.log2(maxHz / minHz)) * height

/** Waveform (min/max per column) with an optional pitch track on a log-frequency axis. */
export function SignalView({ samples, sampleRate, pitch, referenceHz, regions = [], seconds }: SignalViewProps) {
  const { t } = useTranslation()
  const total = Math.max(1, Math.round((seconds ?? samples.length / sampleRate) * sampleRate))
  const xOf = (sample: number): number => (sample / total) * width

  const wave = useMemo(() => {
    const columns = width
    const perColumn = total / columns
    let top = ''
    let bottom = ''
    let peak = 1e-6
    for (const sample of samples)
      peak = Math.max(peak, Math.abs(sample))
    for (let column = 0; column < columns; column++) {
      const from = Math.floor(column * perColumn)
      const to = Math.min(samples.length, Math.floor((column + 1) * perColumn) + 1)
      let low = 0
      let high = 0
      for (let i = from; i < to; i++) {
        low = Math.min(low, samples[i]!)
        high = Math.max(high, samples[i]!)
      }
      top += `${column === 0 ? 'M' : 'L'}${column},${(height / 2) * (1 - high / peak)}`
      bottom = `L${column},${(height / 2) * (1 - low / peak)}${bottom}`
    }
    return `${top}${bottom}Z`
  }, [samples, total])

  const track = useMemo(() => pitch ? trackPitch(samples, sampleRate, pitch) : [], [samples, sampleRate, pitch])
  const loudest = Math.max(1e-6, ...track.map(frame => frame.rms))

  return (
    <svg className="signal" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={t('charts.waveform', { duration: (samples.length / sampleRate * 1000).toFixed(0) })}>
      {regions.map(region => (
        <g key={`${region.start}-${region.label}`}>
          <rect className="signal-region" x={xOf(region.start)} width={Math.max(0, xOf(region.end) - xOf(region.start))} y={0} height={height} />
          <text className="signal-region-label" x={xOf(region.start) + 4} y={14}>{region.label}</text>
        </g>
      ))}
      <path className="signal-wave" d={wave} />
      {referenceHz && <line className="signal-reference" x1={0} x2={width} y1={yOfHz(referenceHz)} y2={yOfHz(referenceHz)} />}
      {track.map(frame => frame.hz !== null && frame.rms > loudest * 0.1 && (
        <circle key={frame.position} className="signal-pitch" cx={xOf(frame.position)} cy={yOfHz(frame.hz)} r={2.2} />
      ))}
    </svg>
  )
}
