import type { ReactNode } from 'react'

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T, label: ReactNode }[]
  onChange: (value: T) => void
}

/** Single-choice pill buttons, built on Base UI's ToggleGroup (animal-island-ui has none). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <ToggleGroup
      className="segmented"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        // Ignore the "unpress" that would leave nothing selected.
        if (next[0])
          onChange(next[0] as T)
      }}
    >
      {options.map(option => (
        <Toggle key={option.value} value={option.value} className="segmented-item">
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
