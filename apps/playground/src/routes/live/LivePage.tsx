import type { LanguageCode, Playback, VoicePreset } from 'animalese'

import { errorMessageFrom } from '@moeru/std'
import { Button, Select } from 'animal-island-ui'
import { playSpeech, streamSpeech, textStreamFromSpeechRecognition, toMediaStream, voicePresets } from 'animalese'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese, useAnimaleseNames } from '../../app/animalese'
import { useVoice, useVoiceState } from '../../app/voice'
import { DialogueBox } from '../../components/DialogueBox'
import { ParamSlider } from '../../components/ParamSlider'
import { Segmented } from '../../components/Segmented'
import { TextArea } from '../../components/TextArea'
import { createRecognizer, recognitionAvailable, watchInterim } from './recognition'

type Source = 'mic' | 'typing'
type Output = 'speaker' | 'media'

const recognitionLanguages: Record<Exclude<LanguageCode, 'en'> | 'en', string> = {
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  en: 'en-US',
}

/**
 * Text that streams in, spoken as it arrives: from the microphone through speech
 * recognition, or from the keyboard. Voice knobs apply while it speaks.
 */
export function LivePage() {
  const { t } = useTranslation()
  const { languageNames, presetNames } = useAnimaleseNames()
  const { banks, audioContext } = useAnimalese()
  const voiceState = useVoiceState('peppy')
  const voice = useVoice(banks, voiceState.input)
  const [source, setSource] = useState<Source>(recognitionAvailable ? 'mic' : 'typing')
  const [output, setOutput] = useState<Output>('speaker')
  const [language, setLanguage] = useState<LanguageCode>('zh')
  const [chinese, setChinese] = useState<'kana' | 'syllables'>('kana')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [revealed, setRevealed] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const playbackRef = useRef<Playback | null>(null)
  const stopInputRef = useRef<(() => void) | null>(null)
  // The typed text the stream has seen, and how to feed it more.
  const typedRef = useRef('')
  const feedRef = useRef<ReadableStreamDefaultController<string> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioRef.current)
      audioRef.current.srcObject = mediaStream
  }, [mediaStream])

  const stop = () => {
    stopInputRef.current?.()
    stopInputRef.current = null
    feedRef.current = null
    playbackRef.current?.stop()
    playbackRef.current = null
    setRunning(false)
    setInterim('')
  }

  useEffect(() => stop, [])

  const start = () => {
    if (!voice)
      return
    stop()
    setError('')
    setTranscript('')
    setRevealed(0)
    typedRef.current = ''

    let text: ReadableStream<string>
    if (source === 'mic') {
      const recognizer = createRecognizer(recognitionLanguages[language])
      if (!recognizer) {
        setError(t('live.unsupported'))
        return
      }
      watchInterim(recognizer, setInterim)
      text = textStreamFromSpeechRecognition(recognizer)
      // Show the final transcript as the stream reads it.
      text = text.pipeThrough(new TransformStream<string, string>({
        transform(piece, controller) {
          setTranscript(current => current + piece)
          setInterim('')
          controller.enqueue(piece)
        },
      }))
      recognizer.addEventListener('error', event => setError(t('live.recognitionError', { error: (event as Event & { error?: string }).error ?? 'unknown' })))
      recognizer.start()
      stopInputRef.current = () => recognizer.stop()
    }
    else {
      text = new ReadableStream<string>({
        start(controller) {
          feedRef.current = controller
        },
      })
      stopInputRef.current = () => feedRef.current?.close()
    }

    const speech = streamSpeech(text, voice, { language, chinese })
    const options = {
      context: audioContext(),
      onMark: (mark: { end: number }) => setRevealed(mark.end),
    }
    try {
      if (output === 'media') {
        const result = toMediaStream(speech, options)
        setMediaStream(result.stream)
        playbackRef.current = result
      }
      else {
        playbackRef.current = playSpeech(speech, options)
      }
      setRunning(true)
    }
    catch (cause) {
      setError(errorMessageFrom(cause) ?? String(cause))
    }
  }

  // Typing feeds only what was added at the end; edits before the end cannot be unsaid.
  const type = (next: string) => {
    setTranscript(next)
    const previous = typedRef.current
    if (feedRef.current && next.startsWith(previous) && next.length > previous.length) {
      feedRef.current.enqueue(next.slice(previous.length))
      typedRef.current = next
    }
  }

  const { knobs, setKnobs } = voiceState

  return (
    <div className="speak">
      <section className="speak-main">
        <DialogueBox
          name={`${presetNames[voiceState.preset]} · ${voice?.bank ?? '…'}`}
          text={transcript + (interim ? ` ${interim}` : '') || (running ? '……' : t('live.idle'))}
          revealed={running ? revealed : null}
        />

        <div className="row wrap">
          <Segmented
            label={t('live.input')}
            value={source}
            options={[{ value: 'mic', label: recognitionAvailable ? t('live.microphone') : t('live.microphoneUnsupported') }, { value: 'typing', label: t('live.typing') }]}
            onChange={setSource}
          />
          <Segmented label={t('common.language')} value={language} options={(['zh', 'ja', 'ko', 'en'] as const).map(value => ({ value, label: languageNames[value] }))} onChange={setLanguage} />
          <Segmented label={t('common.chinesePronunciation')} value={chinese} options={[{ value: 'kana', label: t('live.kana') }, { value: 'syllables', label: t('live.pinyinSyllables') }]} onChange={setChinese} />
          <Segmented label={t('live.output')} value={output} options={[{ value: 'speaker', label: t('live.speaker') }, { value: 'media', label: 'MediaStream' }]} onChange={setOutput} />
        </div>

        {source === 'typing' && (
          <TextArea
            value={transcript}
            rows={3}
            disabled={!running}
            placeholder={running ? t('live.typingActive') : t('live.typingIdle')}
            onChange={event => type(event.target.value)}
            aria-label={t('live.realtimeInput')}
          />
        )}

        <div className="row wrap actions">
          {running
            ? <Button type="primary" danger onClick={stop}>{t('common.stop')}</Button>
            : <Button type="primary" disabled={!voice || (source === 'mic' && !recognitionAvailable)} onClick={start}>{t('common.start')}</Button>}
          <span className="muted">
            {source === 'mic'
              ? t('live.micHint')
              : t('live.typingHint')}
          </span>
        </div>

        {output === 'media' && (
          <audio ref={audioRef} className="media-output" controls autoPlay>
            <track kind="captions" />
          </audio>
        )}
        {error && <p className="banner error">{error}</p>}
      </section>

      <aside className="speak-side card-surface">
        <div className="voice-panel">
          <label className="field">
            <span>{t('common.personality')}</span>
            <Select
              aria-label={t('common.personality')}
              value={voiceState.preset}
              onChange={key => voiceState.setPreset(key as VoicePreset)}
              options={Object.keys(voicePresets).map(key => ({ key, label: presetNames[key as VoicePreset] }))}
            />
          </label>
          <p className="muted">{t('live.knobsHint')}</p>
          <ParamSlider label={t('common.pitch')} value={knobs.baseHz} min={80} max={700} step={5} format={value => `${value} Hz`} onChange={baseHz => setKnobs({ baseHz })} />
          <ParamSlider label={t('common.maxSpeechRate')} value={knobs.speed} min={3} max={20} step={0.5} format={value => t('common.unitsPerSecond', { value })} onChange={speed => setKnobs({ speed })} />
          <ParamSlider label={t('common.liveliness')} value={knobs.liveliness} min={0} max={1} step={0.05} format={value => value.toFixed(2)} onChange={liveliness => setKnobs({ liveliness })} />
        </div>
      </aside>
    </div>
  )
}
