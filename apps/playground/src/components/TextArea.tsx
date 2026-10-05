import type { TextareaHTMLAttributes } from 'react'

/** A multi-line input matching animal-island-ui's Input, which is single-line only. */
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={['textarea', props.className].filter(Boolean).join(' ')} />
}
