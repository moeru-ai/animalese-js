import type { Token } from 'animalese'

import { tokenLanguage } from 'animalese'
import { useTranslation } from 'react-i18next'

import { useAnimaleseNames } from '../app/animalese'

interface TokenStripProps {
  tokens: readonly Token[]
  /** Token indices that get a sound; the rest are drawn as skipped. Omit to show all as voiced. */
  voiced?: ReadonlySet<number>
  active?: number
}

/** Each character (or English syllable) above the unit that voices it. */
export function TokenStrip({ tokens, voiced, active = -1 }: TokenStripProps) {
  const { t } = useTranslation()
  const { languageNames } = useAnimaleseNames()
  return (
    <div className="token-strip" role="list" aria-label={t('token.result')}>
      {/* Tokens are derived from the text and never reordered, so index keys are stable. */}
      {tokens.map((token, index) => {
        if (token.kind !== 'unit') {
          return token.kind === 'pause' && token.pause !== 'space'
            // eslint-disable-next-line react/no-array-index-key
            ? <span key={index} role="listitem" className={index === active ? 'token-pause active' : 'token-pause'}>{token.text}</span>
            : null
        }
        const language = tokenLanguage(token)
        const skipped = voiced !== undefined && !voiced.has(index)
        const classes = ['token', `lang-${language}`, skipped && 'skipped', token.weak && 'weak', index === active && 'active'].filter(Boolean).join(' ')
        return (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} role="listitem" className={classes} title={`${languageNames[language]} · ${token.unit}${token.weak ? ` · ${t('token.weak')}` : ''}${skipped ? ` · ${t('token.skipped')}` : ''}`}>
            <span className="token-text">{token.text}</span>
            <span className="token-unit">{token.unit.slice(token.unit.indexOf('/') + 1)}</span>
          </span>
        )
      })}
    </div>
  )
}
