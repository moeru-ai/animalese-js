import type { LanguageCode, LoadedBank, UnitDefinition } from 'animalese'

import { frontends } from 'animalese'
import { useEffect, useState } from 'react'

import { languageNames, useAnimalese } from '../../app/animalese'
import { mobileQuery, useMediaQuery } from '../../app/media'
import { Segmented } from '../../components/Segmented'
import { audition } from './audition'
import { EnglishMapper } from './EnglishMapper'
import { SyllableChart } from './SyllableChart'
import { UnitDetail } from './UnitDetail'

const languages = (['zh', 'ja', 'ko', 'en'] as const).map(value => ({ value, label: languageNames[value] }))

const descriptions: Record<LanguageCode, string> = {
  zh: '402 个无调音节，按声母 × 韵母排。每个音节用一个常用的单读音字让 TTS 读出来。',
  ja: '101 个假名拍，按五十音图排，拗音单独成行。',
  ko: '19 个初声 × 17 个中声的开音节，收音不发。',
  en: '',
}

export function InventoryPage() {
  const { animalese } = useAnimalese()
  const compact = useMediaQuery(mobileQuery)
  const [language, setLanguage] = useState<LanguageCode>('zh')
  const [chosenVoice, setChosenVoice] = useState<string>()
  const [selected, setSelected] = useState<UnitDefinition>()
  const [loaded, setLoaded] = useState<LoadedBank>()

  const voices = animalese?.library.voices ?? []
  const voice = chosenVoice ?? voices[0]
  const inventory = frontends[language].inventory
  const unit = selected?.id.startsWith(`${language}/`) ? selected : inventory[0]
  // Only use the loaded bank once it matches what is on screen.
  const bank = loaded?.manifest.language === language && loaded.manifest.voice === voice ? loaded : undefined

  const select = (next: UnitDefinition) => {
    setSelected(next)
    if (animalese && bank)
      audition(animalese, bank, next.id)
  }

  useEffect(() => {
    if (!animalese || !voice || language === 'en')
      return
    let cancelled = false
    animalese.library.load(voice, [language]).then((banks) => {
      if (!cancelled)
        setLoaded(banks[language])
    })
    return () => {
      cancelled = true
    }
  }, [animalese, voice, language])

  return (
    <div className="stack">
      <div className="row wrap">
        <Segmented label="语言" value={language} options={languages} onChange={setLanguage} />
        {language !== 'en' && voices.length > 0 && voice && (
          <Segmented label="声库" value={voice} options={voices.map(value => ({ value, label: value }))} onChange={setChosenVoice} />
        )}
      </div>

      {language === 'en'
        ? <EnglishMapper />
        : (
            <>
              <p className="muted">
                {descriptions[language]}
                虚线格是清音（没有基频），点一下可以试听。
              </p>
              <div className="inventory">
                <SyllableChart language={language} inventory={inventory} manifest={bank?.manifest} selected={unit?.id} compact={compact} onSelect={select} />
                {unit && (compact
                  ? <div className="detail-dock"><UnitDetail unit={unit} bank={bank} compact /></div>
                  : <UnitDetail unit={unit} bank={bank} />)}
              </div>
            </>
          )}
    </div>
  )
}
