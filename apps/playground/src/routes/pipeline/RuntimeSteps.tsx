import type { ScaleName, VoicePreset } from 'animalese'

import { Button, Select } from 'animal-island-ui'
import { createVoice, planSpeech, scales, unitLanguage, voicePresets } from 'animalese'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese, useAnimaleseNames } from '../../app/animalese'
import { useSpeech } from '../../app/speech'
import { useVoice, useVoiceState } from '../../app/voice'
import { MelodyPlot } from '../../components/charts/MelodyPlot'
import { Timeline } from '../../components/charts/Timeline'
import { DialogueBox } from '../../components/DialogueBox'
import { ParamSlider } from '../../components/ParamSlider'
import { StepCard } from '../../components/StepCard'
import { TextArea } from '../../components/TextArea'
import { TokenStrip } from '../../components/TokenStrip'

/** The runtime half: one text, followed through segmentation, the two clocks, melody and playback. */
export function RuntimeSteps({ firstIndex }: { firstIndex: number }) {
  const { t } = useTranslation()
  const { languageNames, presetNames } = useAnimaleseNames()
  const { banks } = useAnimalese()
  const voiceState = useVoiceState()
  const speech = useSpeech()
  const [text, setText] = useState('我也很喜欢秋天，因为万圣节的时候可以得到好多糖果呢？')
  const [seed, setSeed] = useState<number>()
  const { knobs, setKnobs } = voiceState

  const voice = useVoice(banks, voiceState.input)
  // Plan with a snapshot of the knobs; the playing voice reads them live.
  const plan = useMemo(() => banks && planSpeech(text, createVoice(banks, voiceState.input), { seed }), [banks, text, seed, voiceState.input])
  const units = plan?.schedule.events.filter(event => event.type === 'unit') ?? []
  const voiced = new Set(units.map(event => event.token))
  const unitTokens = plan?.tokens.filter(token => token.kind === 'unit').length ?? 0
  const referenceHz = (unit: string) => banks?.entries.find(entry => entry.voice === plan?.bank && entry.language === unitLanguage(unit))?.referenceHz

  return (
    <>
      <div className="runtime-input">
        <TextArea value={text} rows={2} onChange={event => setText(event.target.value)} aria-label={t('pipeline.exampleText')} />
        <label className="field inline">
          <span>{t('common.personality')}</span>
          <Select
            aria-label={t('common.personality')}
            value={voiceState.preset}
            onChange={key => voiceState.setPreset(key as VoicePreset)}
            options={Object.keys(voicePresets).map(key => ({ key, label: presetNames[key as VoicePreset] }))}
          />
        </label>
      </div>

      {plan && (
        <>
          <StepCard id="analyze" index={firstIndex} title={t('pipeline.steps.analyze')} summary={t('pipeline.summaries.analyze')}>
            <TokenStrip tokens={plan.tokens} />
            <p className="muted">
              {t('pipeline.requiredBanks', { languages: plan.languages.map(code => languageNames[code]).join(', ') || t('common.none') })}
            </p>
          </StepCard>

          <StepCard id="clocks" index={firstIndex + 1} title={t('pipeline.steps.clocks')} summary={t('pipeline.summaries.clocks')}>
            <div className="knobs">
              <ParamSlider label={t('common.textRate')} value={knobs.textRate} min={4} max={24} step={0.5} format={value => t('common.charsPerSecond', { value })} onChange={textRate => setKnobs({ textRate })} />
              <ParamSlider label={t('common.maxSpeechRate')} value={knobs.speed} min={3} max={20} step={0.5} format={value => t('common.unitsPerSecond', { value })} onChange={speed => setKnobs({ speed })} />
            </div>
            <Timeline tokens={plan.tokens} plan={plan.schedule} />
            <TokenStrip tokens={plan.tokens} voiced={voiced} />
            <p className="muted">{t('pipeline.counts', { total: unitTokens, voiced: voiced.size, skipped: unitTokens - voiced.size })}</p>
          </StepCard>

          <StepCard id="melody" index={firstIndex + 2} title={t('pipeline.steps.melody')} summary={t('pipeline.summaries.melody')}>
            <div className="knobs">
              <label className="field">
                <span>{t('common.scale')}</span>
                <Select aria-label={t('common.scale')} value={knobs.scale} onChange={key => setKnobs({ scale: key as ScaleName })} options={Object.keys(scales).map(key => ({ key, label: key }))} />
              </label>
              <ParamSlider label={t('common.range')} value={knobs.range} min={0} max={8} step={1} format={value => `±${value} ${t('common.steps')}`} onChange={range => setKnobs({ range })} />
              <ParamSlider label={t('common.liveliness')} value={knobs.liveliness} min={0} max={1} step={0.05} format={value => value.toFixed(2)} onChange={liveliness => setKnobs({ liveliness })} />
              <ParamSlider label={t('common.glide')} value={knobs.glide} min={-4} max={2} step={0.1} format={value => `${value.toFixed(1)} ${t('common.semitones')}`} onChange={glide => setKnobs({ glide })} />
            </div>
            <MelodyPlot plan={plan.schedule} voice={plan.voice} />
            <div className="row">
              <Button size="small" onClick={() => setSeed(Math.floor(Math.random() * 2 ** 32))}>{t('pipeline.newSeed')}</Button>
              {seed !== undefined && <Button size="small" type="text" onClick={() => setSeed(undefined)}>{t('pipeline.textSeed')}</Button>}
            </div>
          </StepCard>

          <StepCard id="play" index={firstIndex + 3} title={t('pipeline.steps.play')} summary={t('pipeline.summaries.play')}>
            <DialogueBox name={`${presetNames[voiceState.preset]} · ${plan.bank ?? '…'}`} text={text} revealed={speech.revealed} />
            <div className="row">
              <ParamSlider label={t('common.pitch')} value={knobs.baseHz} min={80} max={700} step={5} format={value => `${value} Hz`} onChange={baseHz => setKnobs({ baseHz })} />
            </div>
            <div className="row">
              <Button type="primary" disabled={!voice || speech.playing} onClick={() => voice && speech.say(text, voice, { seed })}>{t('common.speak')}</Button>
              {speech.error && <span className="banner error">{speech.error}</span>}
            </div>
            <div className="table-scroll">
              <table className="rate-table">
                <thead>
                  <tr>
                    <th scope="col">{t('pipeline.table.text')}</th>
                    <th scope="col">{t('pipeline.table.unit')}</th>
                    <th scope="col">{t('pipeline.table.start')}</th>
                    <th scope="col">{t('pipeline.table.targetPitch')}</th>
                    <th scope="col">{t('pipeline.table.playbackRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((event) => {
                    const reference = referenceHz(event.unit)
                    return (
                      <tr key={event.token} className={event.token === speech.active ? 'active' : undefined}>
                        <td>{plan.tokens[event.token]!.text}</td>
                        <td><code>{event.unit}</code></td>
                        <td>{`${(event.time * 1000).toFixed(0)} ms`}</td>
                        <td>{`${event.hz.toFixed(0)} Hz`}</td>
                        <td>{reference ? `× ${(event.hz / reference).toFixed(2)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </StepCard>
        </>
      )}
    </>
  )
}
