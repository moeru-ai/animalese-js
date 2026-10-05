import type { LanguageCode, UnitDefinition } from 'animalese'

/** Conventional pinyin table order; anything else is appended in first-seen order. */
const pinyinRows = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w']
const pinyinColumns = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'üe', 'üan', 'ün', 'm', 'n', 'ng', 'hm', 'hng']

function ordered(values: string[], preferred: readonly string[] = []): string[] {
  const unique = [...new Set(values)]
  const known = preferred.filter(value => unique.includes(value))
  return [...known, ...unique.filter(value => !preferred.includes(value))]
}

export interface Chart {
  rows: string[]
  columns: string[]
  cell: (row: string, column: string) => UnitDefinition | undefined
}

/** Lays an inventory out on its language's syllable chart. */
export function chartOf(language: LanguageCode, inventory: readonly UnitDefinition[]): Chart {
  const zh = language === 'zh'
  const rows = ordered(inventory.map(unit => unit.chart.row), zh ? pinyinRows : [])
  const columns = ordered(inventory.map(unit => unit.chart.column), zh ? pinyinColumns : [])
  const cells = new Map(inventory.map(unit => [`${unit.chart.row}|${unit.chart.column}`, unit]))
  return { rows, columns, cell: (row, column) => cells.get(`${row}|${column}`) }
}

/** Header labels: an empty pinyin initial is a zero-initial syllable. */
export function rowLabel(language: LanguageCode, row: string): string {
  return row === '' ? (language === 'zh' ? '∅' : '·') : row
}
