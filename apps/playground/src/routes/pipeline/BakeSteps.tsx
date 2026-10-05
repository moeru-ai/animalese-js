import type { DemoClip } from './recording'

import { applyFades, estimatePitch, flattenPitch, normalizeLoudness, pitchBand, trimConsonant, trimSilence } from '@animalese/dsp'
import { Button } from 'animal-island-ui'
import { useEffect, useMemo, useState } from 'react'

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
  const { animalese } = useAnimalese()
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
    if (!animalese)
      return
    setMicError('')
    setRecording(true)
    try {
      setRaw(await recordMicrophone(animalese.audioContext()))
      setClipId('mic')
    }
    catch (cause) {
      setMicError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setRecording(false)
    }
  }

  const seconds = raw ? raw.length / sampleRate : 1
  const listen = (samples: Float32Array) => (
    <Button size="small" onClick={() => playClip(samples, sampleRate)}>听</Button>
  )

  return (
    <>
      <div className="row wrap">
        <Segmented
          label="录音"
          value={clipId}
          options={[...clips.map(clip => ({ value: clip.id, label: `${clip.carrier} ${clip.reading}` })), ...(clipId === 'mic' ? [{ value: 'mic', label: '我的声音' }] : [])]}
          onChange={setClipId}
        />
        <Button size="small" type="dashed" loading={recording} onClick={record}>{recording ? '录音中…' : '录自己的声音（1.5 秒）'}</Button>
      </div>
      {micError && <p className="banner error">{`麦克风不可用：${micError}`}</p>}

      {raw && stages && (
        <>
          <StepCard id="record" index={firstIndex} title="录音" summary="把载体字发给 TTS，拿回一段完整的发音。前后有静音，音高带着原来的声调。">
            <SignalView samples={raw} sampleRate={sampleRate} pitch={wide} seconds={seconds} />
            <div className="row">
              {listen(raw)}
              <span className="muted">{ms(raw)}</span>
            </div>
          </StepCard>

          <StepCard id="trim" index={firstIndex + 1} title="切静音" summary="按 5 ms 一帧算响度，去掉首尾比最响处低 40 dB 的部分，相当于教程里的“把声音剪断”。">
            <SignalView samples={stages.trimmed} sampleRate={sampleRate} seconds={seconds} />
            <div className="row">
              {listen(stages.trimmed)}
              <span className="muted">{`${ms(raw)} → ${ms(stages.trimmed)}`}</span>
            </div>
          </StepCard>

          <StepCard id="consonant" index={firstIndex + 2} title="缩短辅音" summary="游戏里的单元几乎全是元音。找到开始有基频的地方，前面的辅音只留一小段，免得 s、sh 这样的噪声占满 100 ms 的时间槽。">
            <SignalView
              samples={stages.trimmed}
              sampleRate={sampleRate}
              seconds={seconds}
              regions={[{ start: 0, end: stages.trimmed.length - stages.lead.length, label: '切掉' }]}
            />
            <ParamSlider label="保留辅音" value={leadMs} min={0} max={120} step={5} format={value => `${value} ms`} onChange={setLeadMs} />
            <div className="row">
              {listen(stages.lead)}
              <span className="muted">{stages.f0 ? `录音基频约 ${Math.round(stages.f0)} Hz` : '清音，没有基频，跳过'}</span>
            </div>
          </StepCard>

          <StepCard id="flatten" index={firstIndex + 3} title="拉平音高" summary="用 TD-PSOLA 按基频周期切片，再以固定间隔重新叠加，把整条音高曲线拉成一条直线，时长和音色不变。这就是“每个字拉成平的一声”。">
            <div className="compare">
              <div>
                <p className="caption">之前</p>
                <SignalView samples={stages.lead} sampleRate={sampleRate} pitch={wide} referenceHz={referenceHz} />
              </div>
              <div>
                <p className="caption">之后</p>
                <SignalView samples={stages.flat} sampleRate={sampleRate} pitch={wide} referenceHz={referenceHz} />
              </div>
            </div>
            <ParamSlider label="参考音" value={referenceHz} min={80} max={500} step={1} format={value => `${value} Hz`} hint="烘焙时取整个声库的中位基频，取整到半音。" onChange={setReferenceHz} />
            <div className="row">
              {listen(stages.lead)}
              {listen(stages.flat)}
            </div>
          </StepCard>

          <StepCard id="finish" index={firstIndex + 4} title="截长、淡入淡出、响度" summary="截到最长长度，加 3 ms 淡入和余弦淡出，响度统一到 −18 dBFS。所有单元拼成一个 sprite.wav，manifest.json 记下每个单元的位置。">
            <SignalView samples={stages.final} sampleRate={sampleRate} seconds={seconds} />
            <ParamSlider label="最长" value={maxMs} min={80} max={400} step={10} format={value => `${value} ms`} onChange={setMaxMs} />
            <div className="row">
              {listen(stages.final)}
              <Button size="small" onClick={() => playClip(stages.final, sampleRate, 2)}>升八度听</Button>
              <span className="muted">{ms(stages.final)}</span>
            </div>
          </StepCard>
        </>
      )}
    </>
  )
}
