import type { ScaleName, VoicePreset } from 'animalese'

import type { VoiceState } from '../../app/voice'

import { Select } from 'animal-island-ui'
import { scales, voicePresets } from 'animalese'
import { useTranslation } from 'react-i18next'

import { useAnimaleseNames } from '../../app/animalese'
import { ParamSlider } from '../../components/ParamSlider'

interface VoicePanelProps {
  state: VoiceState
  bank: string
  banks: readonly string[]
  /** Resolved voice when `bank` is `auto`. */
  autoBank: string | undefined
  onBankChange: (bank: string) => void
}

/** Personality, recorded voice and the knobs that shape the babble. */
export function VoicePanel({ state, bank, banks, autoBank, onBankChange }: VoicePanelProps) {
  const { t } = useTranslation()
  const { presetNames } = useAnimaleseNames()
  const { preset, knobs, setPreset, setKnobs } = state
  return (
    <div className="voice-panel">
      <label className="field">
        <span>{t('common.personality')}</span>
        <Select
          aria-label={t('common.personality')}
          value={preset}
          onChange={key => setPreset(key as VoicePreset)}
          options={Object.keys(voicePresets).map(key => ({ key, label: `${presetNames[key as VoicePreset]} · ${key}` }))}
        />
      </label>
      <label className="field">
        <span>{t('common.voiceBank')}</span>
        <Select
          aria-label={t('common.voiceBank')}
          value={bank}
          onChange={onBankChange}
          options={[{ key: 'auto', label: t('speak.autoBank', { bank: autoBank ?? t('common.none') }) }, ...banks.map(name => ({ key: name, label: name }))]}
        />
      </label>
      <label className="field">
        <span>{t('common.scale')}</span>
        <Select
          aria-label={t('common.scale')}
          value={knobs.scale}
          onChange={key => setKnobs({ scale: key as ScaleName })}
          options={Object.keys(scales).map(key => ({ key, label: key }))}
        />
      </label>
      <ParamSlider label={t('common.pitch')} value={knobs.baseHz} min={80} max={700} step={5} format={value => `${value} Hz`} onChange={baseHz => setKnobs({ baseHz })} />
      <ParamSlider label={t('common.textRate')} value={knobs.textRate} min={4} max={24} step={0.5} format={value => t('common.charsPerSecond', { value })} onChange={textRate => setKnobs({ textRate })} />
      <ParamSlider label={t('common.maxSpeechRate')} value={knobs.speed} min={3} max={20} step={0.5} format={value => t('common.unitsPerSecond', { value })} onChange={speed => setKnobs({ speed })} />
      <ParamSlider label={t('common.range')} value={knobs.range} min={0} max={8} step={1} format={value => `±${value} ${t('common.steps')}`} onChange={range => setKnobs({ range })} />
      <ParamSlider label={t('common.liveliness')} value={knobs.liveliness} min={0} max={1} step={0.05} format={value => value.toFixed(2)} onChange={liveliness => setKnobs({ liveliness })} />
      <ParamSlider label={t('common.glide')} value={knobs.glide} min={-4} max={2} step={0.1} format={value => `${value.toFixed(1)} ${t('common.semitones')}`} onChange={glide => setKnobs({ glide })} />
      <ParamSlider label={t('common.sustain')} value={knobs.sustain} min={-0.5} max={1} step={0.05} format={value => value.toFixed(2)} onChange={sustain => setKnobs({ sustain })} />
    </div>
  )
}
