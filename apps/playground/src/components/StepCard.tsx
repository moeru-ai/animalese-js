import type { ReactNode } from 'react'

interface StepCardProps {
  id: string
  index: number
  title: string
  summary: ReactNode
  children: ReactNode
}

/** One numbered step of the pipeline explainer. */
export function StepCard({ id, index, title, summary, children }: StepCardProps) {
  return (
    <section id={id} className="step" aria-labelledby={`${id}-title`}>
      <header className="step-head">
        <span className="step-index">{index}</span>
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p className="step-summary">{summary}</p>
        </div>
      </header>
      <div className="step-body">{children}</div>
    </section>
  )
}
