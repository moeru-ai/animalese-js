import { Button } from 'animal-island-ui'
import { analyze } from 'animalese'
import { useMemo, useState } from 'react'

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
  const { banks } = useAnimalese()
  const voice = useVoice(banks, smug)
  const speech = useSpeech()
  const [text, setText] = useState('When she grated black truffle over fresh tagliatelle, I would melt.')
  const tokens = useMemo(() => analyze(text, { language: 'en' }), [text])

  return (
    <div className="stack">
      <p className="muted">
        英文没有自己的声库。游戏录屏里英文大约一个音节一个音，所以先按拼写切音节，再把每个音节映射到最接近的假名，用日文声库发声。下面每一格上面是原文，下面是用到的假名单元。
      </p>
      <TextArea value={text} rows={2} onChange={event => setText(event.target.value)} aria-label="英文" />
      <TokenStrip tokens={tokens} active={speech.active} />
      <div className="row">
        <Button type="primary" disabled={!voice} onClick={() => voice && speech.say(text, voice, { language: 'en' })}>听一下</Button>
      </div>
    </div>
  )
}
