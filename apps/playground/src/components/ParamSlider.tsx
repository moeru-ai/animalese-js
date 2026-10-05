import { Slider } from '@base-ui/react/slider'

interface ParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (value: number) => string
  hint?: string
  onChange: (value: number) => void
}

/** A labelled Base UI slider in the island style. */
export function ParamSlider({ label, value, min, max, step, format = String, hint, onChange }: ParamSliderProps) {
  return (
    <Slider.Root className="param" value={value} min={min} max={max} step={step} onValueChange={next => onChange(next as number)}>
      <div className="param-head">
        <Slider.Label className="param-label">{label}</Slider.Label>
        <span className="param-value">{format(value)}</span>
      </div>
      <Slider.Control className="param-control">
        <Slider.Track className="param-track">
          <Slider.Indicator className="param-indicator" />
          <Slider.Thumb className="param-thumb" />
        </Slider.Track>
      </Slider.Control>
      {hint && <p className="param-hint">{hint}</p>}
    </Slider.Root>
  )
}
