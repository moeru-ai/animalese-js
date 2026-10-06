import type { Schedule, Token } from 'animalese'

import { tokenLanguage } from 'animalese'
import { useTranslation } from 'react-i18next'

interface TimelineProps {
  tokens: readonly Token[]
  plan: Schedule
}

const pxPerSecond = 260
const laneText = 34
const laneVoice = 96
const height = 132

/**
 * The two clocks side by side: when each character appears (top) and when the voice says
 * something (bottom). Lines join a character to the sound it triggered; skipped characters
 * have none.
 */
export function Timeline({ tokens, plan }: TimelineProps) {
  const { t } = useTranslation()
  const width = Math.max(320, Math.ceil(plan.duration * pxPerSecond) + 24)
  const x = (time: number): number => 12 + time * pxPerSecond
  const marks = new Map(plan.events.flatMap(event => event.type === 'mark' ? [[event.token, event.time] as const] : []))
  const units = plan.events.filter(event => event.type === 'unit')
  const voiced = new Set(units.map(event => event.token))

  return (
    <div className="timeline-scroll">
      <svg className="timeline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('charts.timeline')}>
        <text className="timeline-lane" x={4} y={laneText - 18}>{t('charts.text')}</text>
        <text className="timeline-lane" x={4} y={laneVoice + 30}>{t('charts.voice')}</text>
        <line className="timeline-axis" x1={0} x2={width} y1={laneText} y2={laneText} />
        <line className="timeline-axis" x1={0} x2={width} y1={laneVoice} y2={laneVoice} />
        {units.map(event => (
          <line key={`link-${event.token}`} className="timeline-link" x1={x(marks.get(event.token)!)} y1={laneText} x2={x(event.time)} y2={laneVoice - 12} />
        ))}
        {tokens.map((token, index) => {
          if (token.kind !== 'unit')
            return null
          const time = marks.get(index)!
          return (
            // eslint-disable-next-line react/no-array-index-key
            <g key={index} className={voiced.has(index) ? `timeline-char lang-${tokenLanguage(token)}` : 'timeline-char skipped'}>
              <line x1={x(time)} x2={x(time)} y1={laneText - 6} y2={laneText + 6} />
              <text x={x(time)} y={laneText - 9} textAnchor="middle">{token.text}</text>
            </g>
          )
        })}
        {units.map(event => (
          <g key={`unit-${event.token}`} className="timeline-unit">
            <rect x={x(event.time)} y={laneVoice - 12} width={Math.max(2, event.maxDuration * pxPerSecond)} height={24} rx={6} />
            <text x={x(event.time) + 3} y={laneVoice + 4}>{event.unit.slice(event.unit.indexOf('/') + 1)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
