import type { BankManifest, LanguageCode, UnitDefinition } from 'animalese'

import { useMemo } from 'react'

import { chartOf, rowLabel } from './chart'

interface SyllableChartProps {
  language: LanguageCode
  inventory: readonly UnitDefinition[]
  manifest: BankManifest | undefined
  selected: string | undefined
  compact: boolean
  onSelect: (unit: UnitDefinition) => void
}

function UnitCell({ unit, manifest, selected, onSelect }: { unit: UnitDefinition, manifest: BankManifest | undefined, selected: boolean, onSelect: (unit: UnitDefinition) => void }) {
  const baked = manifest?.units[unit.id]
  const classes = ['unit-cell', selected && 'selected', !baked && 'missing', baked?.f0 === null && 'unvoiced'].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} onClick={() => onSelect(unit)} aria-pressed={selected} aria-label={`${unit.carrier} ${unit.reading}`}>
      <span className="unit-carrier">{unit.carrier}</span>
      <span className="unit-reading">{unit.reading}</span>
    </button>
  )
}

/**
 * The inventory on its language's own chart. Wide screens get the full grid with sticky
 * headers; narrow screens get one wrapped row of cells per chart row.
 */
export function SyllableChart({ language, inventory, manifest, selected, compact, onSelect }: SyllableChartProps) {
  const chart = useMemo(() => chartOf(language, inventory), [language, inventory])

  if (compact) {
    return (
      <div className="chart-list">
        {chart.rows.map(row => (
          <div key={row} className="chart-list-row">
            <span className="chart-list-head">{rowLabel(language, row)}</span>
            <div className="chart-list-cells">
              {chart.columns.flatMap((column) => {
                const unit = chart.cell(row, column)
                return unit ? [<UnitCell key={unit.id} unit={unit} manifest={manifest} selected={selected === unit.id} onSelect={onSelect} />] : []
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="chart-scroll">
      <table className="chart">
        <thead>
          <tr>
            <th scope="col" />
            {chart.columns.map(column => <th key={column} scope="col">{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map(row => (
            <tr key={row}>
              <th scope="row">{rowLabel(language, row)}</th>
              {chart.columns.map((column) => {
                const unit = chart.cell(row, column)
                return <td key={column}>{unit && <UnitCell unit={unit} manifest={manifest} selected={selected === unit.id} onSelect={onSelect} />}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
