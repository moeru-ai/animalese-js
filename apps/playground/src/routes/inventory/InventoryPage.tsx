import type { PcmBank } from '@animalese/dsp'
import type { LanguageCode, UnitDefinition } from 'animalese'

import { sliceUnit } from '@animalese/dsp'
import { frontends } from 'animalese'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAnimalese, useAnimaleseNames } from '../../app/animalese'
import { mobileQuery, useMediaQuery } from '../../app/media'
import { Segmented } from '../../components/Segmented'
import { useClipPlayer } from '../../components/useClipPlayer'
import { EnglishMapper } from './EnglishMapper'
import { SyllableChart } from './SyllableChart'
import { UnitDetail } from './UnitDetail'

export function InventoryPage() {
  const { t } = useTranslation()
  const { languageNames } = useAnimaleseNames()
  const { banks } = useAnimalese()
  const playClip = useClipPlayer()
  const compact = useMediaQuery(mobileQuery)
  const [language, setLanguage] = useState<LanguageCode>('zh')
  const [chosenVoice, setChosenVoice] = useState<string>()
  const [selected, setSelected] = useState<UnitDefinition>()
  const [loaded, setLoaded] = useState<PcmBank>()

  const voices = banks?.voices ?? []
  const voice = chosenVoice ?? voices[0]
  const inventory = frontends[language].inventory
  const languages = (['zh', 'ja', 'ko', 'en'] as const).map(value => ({ value, label: languageNames[value] }))
  const unit = selected?.id.startsWith(`${language}/`) ? selected : inventory[0]
  // Only use the loaded bank once it matches what is on screen.
  const bank = loaded?.manifest.language === language && loaded.manifest.voice === voice ? loaded : undefined

  const select = (next: UnitDefinition) => {
    setSelected(next)
    const baked = bank?.manifest.units[next.id]
    if (bank && baked)
      playClip(sliceUnit(bank.samples, baked), bank.manifest.sampleRate)
  }

  useEffect(() => {
    if (!banks || !voice || language === 'en')
      return
    let cancelled = false
    void banks.load(voice, [language]).then(([next]) => {
      if (!cancelled)
        setLoaded(next)
    })
    return () => {
      cancelled = true
    }
  }, [banks, voice, language])

  return (
    <div className="stack">
      <div className="row wrap">
        <Segmented label={t('common.language')} value={language} options={languages} onChange={setLanguage} />
        {language !== 'en' && voices.length > 0 && voice && (
          <Segmented label={t('common.voiceBank')} value={voice} options={voices.map(value => ({ value, label: value }))} onChange={setChosenVoice} />
        )}
      </div>

      {language === 'en'
        ? <EnglishMapper />
        : (
            <>
              <p className="muted">
                {t(`inventory.descriptions.${language}`)}
                {' '}
                {t('inventory.chartHint')}
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
