import type { ScaleName, VoicePreset } from 'animalese'

import type { VoiceState } from '../../app/voice'

import { Select } from 'animal-island-ui'
import { scales, voicePresets } from 'animalese'

import { presetNames } from '../../app/animalese'
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
  const { preset, knobs, setPreset, setKnobs } = state
  return (
    <div className="voice-panel">
      <label className="field">
        <span>性格</span>
        <Select
          aria-label="性格"
          value={preset}
          onChange={key => setPreset(key as VoicePreset)}
          options={Object.keys(voicePresets).map(key => ({ key, label: `${presetNames[key as VoicePreset]} · ${key}` }))}
        />
      </label>
      <label className="field">
        <span>声库</span>
        <Select
          aria-label="声库"
          value={bank}
          onChange={onBankChange}
          options={[{ key: 'auto', label: `自动 → ${autoBank ?? '无'}` }, ...banks.map(name => ({ key: name, label: name }))]}
        />
      </label>
      <label className="field">
        <span>音阶</span>
        <Select
          aria-label="音阶"
          value={knobs.scale}
          onChange={key => setKnobs({ scale: key as ScaleName })}
          options={Object.keys(scales).map(key => ({ key, label: key }))}
        />
      </label>
      <ParamSlider label="音高" value={knobs.baseHz} min={80} max={700} step={5} format={value => `${value} Hz`} onChange={baseHz => setKnobs({ baseHz })} />
      <ParamSlider label="打字速度" value={knobs.textRate} min={4} max={24} step={0.5} format={value => `${value} 字/秒`} onChange={textRate => setKnobs({ textRate })} />
      <ParamSlider label="最快语速" value={knobs.speed} min={3} max={20} step={0.5} format={value => `${value} 音/秒`} onChange={speed => setKnobs({ speed })} />
      <ParamSlider label="音域" value={knobs.range} min={0} max={8} step={1} format={value => `±${value} 级`} onChange={range => setKnobs({ range })} />
      <ParamSlider label="起伏" value={knobs.liveliness} min={0} max={1} step={0.05} format={value => value.toFixed(2)} onChange={liveliness => setKnobs({ liveliness })} />
      <ParamSlider label="尾音滑落" value={knobs.glide} min={-4} max={2} step={0.1} format={value => `${value.toFixed(1)} 半音`} onChange={glide => setKnobs({ glide })} />
      <ParamSlider label="连贯" value={knobs.sustain} min={-0.5} max={1} step={0.05} format={value => value.toFixed(2)} onChange={sustain => setKnobs({ sustain })} />
    </div>
  )
}
