import type { PcmBank } from '@animalese/dsp'
import type { UnitDefinition } from 'animalese'

import { sliceUnit } from '@animalese/dsp'
import { Button } from 'animal-island-ui'
import { useMemo } from 'react'

import { SignalView } from '../../components/charts/SignalView'
import { useClipPlayer } from '../../components/useClipPlayer'

interface UnitDetailProps {
  unit: UnitDefinition
  bank: PcmBank | undefined
  /** Drop the waveform, for the small card docked above the mobile tab bar. */
  compact?: boolean
}

/** The selected unit: what was recorded, what came out of baking, and how it sounds. */
export function UnitDetail({ unit, bank, compact = false }: UnitDetailProps) {
  const playClip = useClipPlayer()
  const baked = bank?.manifest.units[unit.id]
  const samples = useMemo(() => bank && baked ? sliceUnit(bank.samples, baked) : undefined, [bank, baked])
  // Playing faster or slower moves the pitch by octaves, as the runtime does.
  const listen = (octaves: number) => {
    if (bank && samples)
      playClip(samples, bank.manifest.sampleRate, 2 ** octaves)
  }

  return (
    <div className={compact ? 'unit-detail compact card-surface' : 'unit-detail card-surface'}>
      <div className="unit-detail-head">
        <span className="unit-detail-carrier">{unit.carrier}</span>
        <div>
          <p className="unit-detail-reading">{unit.reading}</p>
          <p className="muted"><code>{unit.id}</code></p>
        </div>
      </div>
      {baked && bank && samples
        ? (
            <>
              {!compact && <SignalView samples={samples} sampleRate={bank.manifest.sampleRate} pitch={{ minHz: 60, maxHz: 900 }} referenceHz={bank.manifest.referenceHz} />}
              <dl className="facts">
                <div>
                  <dt>时长</dt>
                  <dd>{`${Math.round(baked.length / bank.manifest.sampleRate * 1000)} ms`}</dd>
                </div>
                <div>
                  <dt>录音音高</dt>
                  <dd>{baked.f0 === null ? '清音' : `${Math.round(baked.f0)} Hz`}</dd>
                </div>
                <div>
                  <dt>拉平到</dt>
                  <dd>{`${bank.manifest.referenceHz} Hz`}</dd>
                </div>
              </dl>
              <div className="row wrap">
                <Button size="small" type="primary" onClick={() => listen(0)}>原调</Button>
                <Button size="small" onClick={() => listen(1)}>升八度</Button>
                <Button size="small" onClick={() => listen(-1)}>降八度</Button>
              </div>
            </>
          )
        : <p className="muted">{bank ? '这个声库里没有这个单元。' : '加载声库中…'}</p>}
    </div>
  )
}
