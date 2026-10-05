import { Button } from 'animal-island-ui'
import { useMemo, useState } from 'react'

import { useAnimalese } from '../../app/animalese'
import { TextArea } from '../../components/TextArea'
import { TokenStrip } from '../../components/TokenStrip'

/**
 * English has no bank of its own: words are split into syllables and each syllable is
 * voiced by the nearest Japanese kana, as ACNH's shared Kana bank suggests.
 */
export function EnglishMapper() {
  const { animalese } = useAnimalese()
  const [text, setText] = useState('When she grated black truffle over fresh tagliatelle, I would melt.')
  const plan = useMemo(() => animalese?.plan(text, { language: 'en' }), [animalese, text])

  return (
    <div className="stack">
      <p className="muted">
        英文没有自己的声库。游戏录屏里英文大约一个音节一个音，所以先按拼写切音节，再把每个音节映射到最接近的假名，用日文声库发声。下面每一格上面是原文，下面是用到的假名单元。
      </p>
      <TextArea value={text} rows={2} onChange={event => setText(event.target.value)} aria-label="英文" />
      {plan && <TokenStrip tokens={plan.tokens} />}
      <div className="row">
        <Button type="primary" disabled={!animalese} onClick={() => animalese?.say(text, { language: 'en', voice: { preset: 'smug' } })}>听一下</Button>
      </div>
    </div>
  )
}
