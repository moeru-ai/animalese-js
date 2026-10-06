import type { ScaleName, VoicePreset } from 'animalese'

import { Button, Select } from 'animal-island-ui'
import { createVoice, planSpeech, scales, unitLanguage, voicePresets } from 'animalese'
import { useMemo, useState } from 'react'

import { languageNames, presetNames, useAnimalese } from '../../app/animalese'
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
        <TextArea value={text} rows={2} onChange={event => setText(event.target.value)} aria-label="示例文字" />
        <label className="field inline">
          <span>性格</span>
          <Select
            aria-label="性格"
            value={voiceState.preset}
            onChange={key => voiceState.setPreset(key as VoicePreset)}
            options={Object.keys(voicePresets).map(key => ({ key, label: presetNames[key as VoicePreset] }))}
          />
        </label>
      </div>

      {plan && (
        <>
          <StepCard id="analyze" index={firstIndex} title="切分" summary="按文字系统分段：汉字用 pinyin-pro 按上下文注音（银行 → hang），假名、谚文各自拆开，英文按音节切再映射到假名。轻声字（的、了、吗）标成弱读。">
            <TokenStrip tokens={plan.tokens} />
            <p className="muted">
              {`需要的声库：${plan.languages.map(code => languageNames[code]).join('、') || '无'}。虚线边框的是弱读字。`}
            </p>
          </StepCard>

          <StepCard id="clocks" index={firstIndex + 1} title="两个时钟" summary="对话框按打字速度出字，声音按自己的节奏念：每一拍念刚出现的那个字，跟不上的字直接跳过，弱读字优先让位。对照游戏录屏，中文约 12 字/秒对 8–10 音/秒。">
            <div className="knobs">
              <ParamSlider label="打字速度" value={knobs.textRate} min={4} max={24} step={0.5} format={value => `${value} 字/秒`} onChange={textRate => setKnobs({ textRate })} />
              <ParamSlider label="最快语速" value={knobs.speed} min={3} max={20} step={0.5} format={value => `${value} 音/秒`} onChange={speed => setKnobs({ speed })} />
            </div>
            <Timeline tokens={plan.tokens} plan={plan.schedule} />
            <TokenStrip tokens={plan.tokens} voiced={voiced} />
            <p className="muted">{`${unitTokens} 个字，念出 ${voiced.size} 个，跳过 ${unitTokens - voiced.size} 个。`}</p>
          </StepCard>

          <StepCard id="melody" index={firstIndex + 2} title="旋律" summary="在音阶上随机游走（越靠边越容易往回走），整句慢慢往下沉，问句最后几个音上扬，感叹句整体抬高。每个音尾部再略往下滑。种子默认来自文字，同一句话每次一样。">
            <div className="knobs">
              <label className="field">
                <span>音阶</span>
                <Select aria-label="音阶" value={knobs.scale} onChange={key => setKnobs({ scale: key as ScaleName })} options={Object.keys(scales).map(key => ({ key, label: key }))} />
              </label>
              <ParamSlider label="音域" value={knobs.range} min={0} max={8} step={1} format={value => `±${value} 级`} onChange={range => setKnobs({ range })} />
              <ParamSlider label="起伏" value={knobs.liveliness} min={0} max={1} step={0.05} format={value => value.toFixed(2)} onChange={liveliness => setKnobs({ liveliness })} />
              <ParamSlider label="尾音滑落" value={knobs.glide} min={-4} max={2} step={0.1} format={value => `${value.toFixed(1)} 半音`} onChange={glide => setKnobs({ glide })} />
            </div>
            <MelodyPlot plan={plan.schedule} voice={plan.voice} />
            <div className="row">
              <Button size="small" onClick={() => setSeed(Math.floor(Math.random() * 2 ** 32))}>换一个种子</Button>
              {seed !== undefined && <Button size="small" type="text" onClick={() => setSeed(undefined)}>用回文字种子</Button>}
            </div>
          </StepCard>

          <StepCard id="play" index={firstIndex + 3} title="播放" summary="每个音的播放速率 = 目标音高 ÷ 声库参考音，音高和时长一起变（磁带式）。超出时间槽的部分在下一个音之前收掉。声库按音高自动挑：低音角色用低音录音，共振峰才自然。">
            <DialogueBox name={`${presetNames[voiceState.preset]} · ${plan.bank ?? '…'}`} text={text} revealed={speech.revealed} />
            <div className="row">
              <ParamSlider label="音高" value={knobs.baseHz} min={80} max={700} step={5} format={value => `${value} Hz`} onChange={baseHz => setKnobs({ baseHz })} />
            </div>
            <div className="row">
              <Button type="primary" disabled={!voice || speech.playing} onClick={() => voice && speech.say(text, voice, { seed })}>说话！</Button>
              {speech.error && <span className="banner error">{speech.error}</span>}
            </div>
            <div className="table-scroll">
              <table className="rate-table">
                <thead>
                  <tr>
                    <th scope="col">字</th>
                    <th scope="col">单元</th>
                    <th scope="col">开始</th>
                    <th scope="col">目标音高</th>
                    <th scope="col">播放速率</th>
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
