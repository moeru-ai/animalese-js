import type { DemoClip } from './recording'

import { applyFades, estimatePitch, flattenPitch, normalizeLoudness, pitchBand, trimConsonant, trimSilence } from '@animalese/dsp'
import { errorMessageFrom } from '@moeru/std'
import { Button } from 'animal-island-ui'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese } from '../../app/animalese'
import { SignalView } from '../../components/charts/SignalView'
import { ParamSlider } from '../../components/ParamSlider'
import { Segmented } from '../../components/Segmented'
import { StepCard } from '../../components/StepCard'
import { useClipPlayer } from '../../components/useClipPlayer'
import { loadDemoClip, loadDemoClips, recordMicrophone, sampleRate } from './recording'

const wide = { minHz: 60, maxHz: 900 }
const ms = (samples: Float32Array): string => `${Math.round(samples.length / sampleRate * 1000)} ms`

/** The offline half, run live on one recording with the same code the baker uses. */
export function BakeSteps({ firstIndex }: { firstIndex: number }) {
  const { t } = useTranslation()
  const { audioContext } = useAnimalese()
  const playClip = useClipPlayer()
  const [clips, setClips] = useState<DemoClip[]>([])
  const [clipId, setClipId] = useState('zh/hao')
  const [raw, setRaw] = useState<Float32Array>()
  const [recording, setRecording] = useState(false)
  const [micError, setMicError] = useState('')
  const [leadMs, setLeadMs] = useState(30)
  const [referenceHz, setReferenceHz] = useState(196)
  const [maxMs, setMaxMs] = useState(260)

  useEffect(() => {
    void loadDemoClips().then(setClips)
  }, [])

  useEffect(() => {
    const clip = clips.find(item => item.id === clipId)
    if (!clip)
      return
    let cancelled = false
    void loadDemoClip(clip).then((samples) => {
      if (!cancelled)
        setRaw(samples)
    })
    return () => {
      cancelled = true
    }
  }, [clips, clipId])

  const stages = useMemo(() => {
    if (!raw)
      return undefined
    const trimmed = trimSilence(raw, sampleRate)
    const f0 = estimatePitch(trimmed, sampleRate)
    const lead = f0 ? trimConsonant(trimmed, sampleRate, f0, leadMs) : trimmed
    const flat = f0 ? flattenPitch(lead, sampleRate, referenceHz, pitchBand(f0)) : lead
    const capped = flat.slice(0, Math.round(sampleRate * maxMs / 1000))
    const final = normalizeLoudness(applyFades(capped, sampleRate, 3, Math.min(40, maxMs / 4)))
    return { trimmed, f0, lead, flat, final }
  }, [raw, leadMs, referenceHz, maxMs])

  const record = async () => {
    setMicError('')
    setRecording(true)
    try {
      setRaw(await recordMicrophone(audioContext()))
      setClipId('mic')
    }
    catch (cause) {
      setMicError(errorMessageFrom(cause) ?? String(cause))
    }
    finally {
      setRecording(false)
    }
  }

  const seconds = raw ? raw.length / sampleRate : 1
  const listen = (samples: Float32Array) => (
    <Button size="small" onClick={() => playClip(samples, sampleRate)}>{t('common.listen')}</Button>
  )

  return (
    <>
      <div className="row wrap">
        <Segmented
          label={t('pipeline.steps.record')}
          value={clipId}
          options={[...clips.map(clip => ({ value: clip.id, label: `${clip.carrier} ${clip.reading}` })), ...(clipId === 'mic' ? [{ value: 'mic', label: t('pipeline.bake.myVoice') }] : [])]}
          onChange={setClipId}
        />
        <Button size="small" type="dashed" loading={recording} onClick={record}>{recording ? t('pipeline.bake.recording') : t('pipeline.bake.recordOwn')}</Button>
      </div>
      {micError && <p className="banner error">{t('pipeline.bake.microphoneError', { error: micError })}</p>}

      {raw && stages && (
        <>
          <StepCard id="record" index={firstIndex} title={t('pipeline.steps.record')} summary={t('pipeline.bake.recordSummary')}>
            <SignalView samples={raw} sampleRate={sampleRate} pitch={wide} seconds={seconds} />
            <div className="row">
              {listen(raw)}
              <span className="muted">{ms(raw)}</span>
            </div>
          </StepCard>

          <StepCard id="trim" index={firstIndex + 1} title={t('pipeline.steps.trim')} summary={t('pipeline.bake.trimSummary')}>
            <SignalView samples={stages.trimmed} sampleRate={sampleRate} seconds={seconds} />
            <div className="row">
              {listen(stages.trimmed)}
              <span className="muted">{`${ms(raw)} → ${ms(stages.trimmed)}`}</span>
            </div>
          </StepCard>

          <StepCard id="consonant" index={firstIndex + 2} title={t('pipeline.steps.consonant')} summary={t('pipeline.bake.consonantSummary')}>
            <SignalView
              samples={stages.trimmed}
              sampleRate={sampleRate}
              seconds={seconds}
              regions={[{ start: 0, end: stages.trimmed.length - stages.lead.length, label: t('pipeline.bake.cut') }]}
            />
            <ParamSlider label={t('pipeline.bake.keepConsonant')} value={leadMs} min={0} max={120} step={5} format={value => `${value} ms`} onChange={setLeadMs} />
            <div className="row">
              {listen(stages.lead)}
              <span className="muted">{stages.f0 ? t('pipeline.bake.estimatedPitch', { pitch: Math.round(stages.f0) }) : t('pipeline.bake.noPitch')}</span>
            </div>
          </StepCard>

          <StepCard id="flatten" index={firstIndex + 3} title={t('pipeline.steps.flatten')} summary={t('pipeline.bake.flattenSummary')}>
            <div className="compare">
              <div>
                <p className="caption">{t('pipeline.bake.before')}</p>
                <SignalView samples={stages.lead} sampleRate={sampleRate} pitch={wide} referenceHz={referenceHz} />
              </div>
              <div>
                <p className="caption">{t('pipeline.bake.after')}</p>
                <SignalView samples={stages.flat} sampleRate={sampleRate} pitch={wide} referenceHz={referenceHz} />
              </div>
            </div>
            <ParamSlider label={t('pipeline.bake.referencePitch')} value={referenceHz} min={80} max={500} step={1} format={value => `${value} Hz`} hint={t('pipeline.bake.referenceHint')} onChange={setReferenceHz} />
            <div className="row">
              {listen(stages.lead)}
              {listen(stages.flat)}
            </div>
          </StepCard>

          <StepCard id="finish" index={firstIndex + 4} title={t('pipeline.steps.finish')} summary={t('pipeline.bake.finishSummary')}>
            <SignalView samples={stages.final} sampleRate={sampleRate} seconds={seconds} />
            <ParamSlider label={t('pipeline.bake.maximum')} value={maxMs} min={80} max={400} step={10} format={value => `${value} ms`} onChange={setMaxMs} />
            <div className="row">
              {listen(stages.final)}
              <Button size="small" onClick={() => playClip(stages.final, sampleRate, 2)}>{t('pipeline.bake.listenOctaveUp')}</Button>
              <span className="muted">{ms(stages.final)}</span>
            </div>
          </StepCard>
        </>
      )}
    </>
  )
}
