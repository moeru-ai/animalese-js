import type { LanguageCode } from 'animalese'

import { errorMessageFrom } from '@moeru/std'
import { Button, Drawer, Tag } from 'animal-island-ui'
import { createVoice, generateSpeech, planSpeech } from 'animalese'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese, useAnimaleseNames } from '../../app/animalese'
import { mobileQuery, useMediaQuery } from '../../app/media'
import { useSpeech } from '../../app/speech'
import { useVoice, useVoiceState } from '../../app/voice'
import { DialogueBox } from '../../components/DialogueBox'
import { Segmented } from '../../components/Segmented'
import { TextArea } from '../../components/TextArea'
import { TokenStrip } from '../../components/TokenStrip'
import { VoicePanel } from './VoicePanel'

const samples = [
  '哎呀，你来啦！今天的天气真不错，要不要一起去钓鱼？',
  'こんにちは！きょうは いい てんき だね。いっしょに むし とり しよう！',
  '안녕하세요! 오늘 날씨가 정말 좋네요. 같이 낚시하러 갈래요?',
  'I miss my mom\'s pasta too! When she grated black truffle over fresh tagliatelle, I would melt.',
  '我刚刚在 Nook 商店买了 3 个家具，ラッキー！',
]

type LanguageChoice = LanguageCode | 'auto'

export function SpeakPage() {
  const { t } = useTranslation()
  const { languageNames, presetNames } = useAnimaleseNames()
  const { banks } = useAnimalese()
  const voiceState = useVoiceState()
  const mobile = useMediaQuery(mobileQuery)
  const [text, setText] = useState(samples[0]!)
  const [language, setLanguage] = useState<LanguageChoice>('auto')
  const [chinese, setChinese] = useState<'kana' | 'syllables'>('kana')
  const [bank, setBank] = useState('auto')
  const [panelOpen, setPanelOpen] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')
  const speech = useSpeech()
  const voice = useVoice(banks, voiceState.input, bank)

  // Plan with a snapshot of the knobs; the playing voice reads them live.
  const plan = useMemo(() => banks && planSpeech(text, createVoice(banks, voiceState.input, { bank: bank === 'auto' ? undefined : bank }), { language, chinese }), [banks, text, language, chinese, voiceState.input, bank])
  const voiced = useMemo(() => new Set(plan?.schedule.events.flatMap(event => event.type === 'unit' ? [event.token] : [])), [plan])
  const unitCount = plan?.tokens.filter(token => token.kind === 'unit').length ?? 0
  const error = speech.error || renderError
  const chineseOptions = [
    { value: 'kana', label: t('speak.chineseKana') },
    { value: 'syllables', label: t('speak.chineseSyllables') },
  ] as const
  const languageOptions = [
    { value: 'auto', label: t('speak.autoLanguage') },
    ...Object.entries(languageNames).map(([value, label]) => ({ value: value as LanguageCode, label })),
  ] as const

  const download = async () => {
    if (!voice)
      return
    setRendering(true)
    setRenderError('')
    try {
      const wav = await generateSpeech(text, voice, { language, chinese })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }))
      link.download = `animalese-${plan?.bank ?? 'voice'}.wav`
      link.click()
      URL.revokeObjectURL(link.href)
    }
    catch (cause) {
      setRenderError(errorMessageFrom(cause) ?? String(cause))
    }
    finally {
      setRendering(false)
    }
  }

  const panel = (
    <VoicePanel
      state={voiceState}
      bank={bank}
      banks={banks?.voices ?? []}
      autoBank={banks?.voiceFor(voiceState.knobs.baseHz)}
      onBankChange={setBank}
    />
  )

  return (
    <div className="speak">
      <section className="speak-main">
        <DialogueBox name={`${presetNames[voiceState.preset]} · ${plan?.bank ?? '…'}`} text={text} revealed={speech.revealed} />

        <TextArea value={text} rows={3} onChange={event => setText(event.target.value)} aria-label={t('speak.textLabel')} />
        <div className="row wrap">
          {samples.map(sample => (
            <Tag key={sample} size="small" variant="soft" onClick={() => setText(sample)}>
              {[...sample].slice(0, 8).join('')}
              …
            </Tag>
          ))}
        </div>

        <div className="row wrap">
          <Segmented label={t('common.language')} value={language} options={languageOptions} onChange={setLanguage} />
          <Segmented label={t('common.chinesePronunciation')} value={chinese} options={chineseOptions} onChange={setChinese} />
        </div>

        <div className="row wrap actions">
          {speech.playing
            ? <Button type="primary" danger onClick={speech.stop}>{t('common.stop')}</Button>
            : <Button type="primary" disabled={!voice || unitCount === 0} onClick={() => voice && speech.say(text, voice, { language, chinese })}>{t('common.speak')}</Button>}
          <Button loading={rendering} disabled={!plan || unitCount === 0} onClick={download}>{t('speak.exportWav')}</Button>
          {mobile && <Button type="dashed" onClick={() => setPanelOpen(true)}>{t('speak.tuneVoice')}</Button>}
          {plan && (
            <span className="muted">
              {t('speak.stats', { total: unitCount, voiced: voiced.size, duration: plan.schedule.duration.toFixed(2) })}
            </span>
          )}
        </div>

        {plan && plan.missing.length > 0 && (
          <p className="banner warn">
            {t('speak.missing', { bank: plan.bank ?? '', languages: plan.missing.map(code => languageNames[code]).join(', ') })}
          </p>
        )}
        {error && <p className="banner error">{error}</p>}

        {plan && <TokenStrip tokens={plan.tokens} voiced={voiced} active={speech.active} />}
      </section>

      {/* animal-island-ui's closed Drawer renders inert="" (React 19 wants a boolean), so mount it only while open. */}
      {mobile
        ? panelOpen && <Drawer open placement="bottom" height="80vh" title={t('speak.voice')} onClose={() => setPanelOpen(false)}>{panel}</Drawer>
        : <aside className="speak-side card-surface">{panel}</aside>}
    </div>
  )
}
