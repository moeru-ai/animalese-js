import type { Schedule, VoiceOptions } from 'animalese'

import { degreeToSemitones, scales } from 'animalese'
import { useTranslation } from 'react-i18next'

interface MelodyPlotProps {
  plan: Schedule
  voice: VoiceOptions
}

const pxPerSecond = 260
const pxPerSemitone = 7
const height = 200

/**
 * Each voiced unit as a short bar at its pitch, against the scale's notes. Bars tilt by the
 * unit's glide; the dashed line is `baseHz`.
 */
export function MelodyPlot({ plan, voice }: MelodyPlotProps) {
  const { t } = useTranslation()
  const units = plan.events.filter(event => event.type === 'unit')
  const width = Math.max(320, Math.ceil(plan.duration * pxPerSecond) + 24)
  const center = height / 2
  const y = (semitones: number): number => center - semitones * pxPerSemitone
  const semitonesOf = (hz: number): number => 12 * Math.log2(hz / voice.baseHz)
  const scale = scales[voice.scale]
  const grid = Array.from({ length: 31 }, (_, i) => degreeToSemitones(scale, i - 15)).filter(value => Math.abs(y(value) - center) < center - 4)

  return (
    <div className="timeline-scroll">
      <svg className="melody" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('charts.melody')}>
        {grid.map(value => <line key={value} className={value % 12 === 0 ? 'melody-tonic' : 'melody-grid'} x1={0} x2={width} y1={y(value)} y2={y(value)} />)}
        <line className="melody-base" x1={0} x2={width} y1={center} y2={center} />
        {units.map((event) => {
          const start = 12 + event.time * pxPerSecond
          const end = start + event.maxDuration * pxPerSecond
          const from = y(semitonesOf(event.hz))
          return (
            <g key={event.token} className="melody-note">
              <line x1={start} x2={end} y1={from} y2={from - event.glide * pxPerSemitone} />
              <text x={start} y={from - 8}>{event.unit.slice(event.unit.indexOf('/') + 1)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
