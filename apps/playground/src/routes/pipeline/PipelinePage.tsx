import { Title } from 'animal-island-ui'
import { useTranslation } from 'react-i18next'

import { BakeSteps } from './BakeSteps'
import { RuntimeSteps } from './RuntimeSteps'

const steps = [
  'record',
  'trim',
  'consonant',
  'flatten',
  'finish',
  'analyze',
  'clocks',
  'melody',
  'play',
] as const

/** The whole pipeline, one interactive step at a time. */
export function PipelinePage() {
  const { t } = useTranslation()
  return (
    <div className="pipeline">
      <nav className="step-nav" aria-label={t('pipeline.stepsLabel')}>
        {steps.map((id, index) => (
          <a key={id} href={`#${id}`}>
            <span className="step-nav-index">{index + 1}</span>
            {t(`pipeline.steps.${id}`)}
          </a>
        ))}
      </nav>

      <div className="pipeline-body">
        <p className="lead">
          {t('pipeline.introBefore')}
          <a href="https://www.bilibili.com/video/BV1Mf4y1S7Gs" target="_blank" rel="noreferrer">{t('pipeline.tutorial')}</a>
          {t('pipeline.introAfter')}
        </p>

        <Title size="small" variant="layer" color="app-orange">{t('pipeline.offline')}</Title>
        <BakeSteps firstIndex={1} />

        <Title size="small" variant="layer" color="app-blue">{t('pipeline.runtime')}</Title>
        <RuntimeSteps firstIndex={6} />
      </div>
    </div>
  )
}
