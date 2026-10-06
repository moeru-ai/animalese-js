import { Button } from 'animal-island-ui'
import { analyze } from 'animalese'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese } from '../../app/animalese'
import { useSpeech } from '../../app/speech'
import { useVoice } from '../../app/voice'
import { TextArea } from '../../components/TextArea'
import { TokenStrip } from '../../components/TokenStrip'

const smug = { preset: 'smug' } as const

/**
 * English has no bank of its own: words are split into syllables and each syllable is
 * voiced by the nearest Japanese kana, as ACNH's shared Kana bank suggests.
 */
export function EnglishMapper() {
  const { t } = useTranslation()
  const { banks } = useAnimalese()
  const voice = useVoice(banks, smug)
  const speech = useSpeech()
  const [text, setText] = useState('When she grated black truffle over fresh tagliatelle, I would melt.')
  const tokens = useMemo(() => analyze(text, { language: 'en' }), [text])

  return (
    <div className="stack">
      <p className="muted">{t('inventory.englishDescription')}</p>
      <TextArea value={text} rows={2} onChange={event => setText(event.target.value)} aria-label={t('inventory.englishLabel')} />
      <TokenStrip tokens={tokens} active={speech.active} />
      <div className="row">
        <Button type="primary" disabled={!voice} onClick={() => voice && speech.say(text, voice, { language: 'en' })}>{t('inventory.englishListen')}</Button>
      </div>
    </div>
  )
}
