import { describe, expect, it } from 'vitest'

import { enLetters, frontends, ja, ko, zh } from '../src/index.ts'

describe.each([zh, ja, ko, enLetters])('$language inventory', (frontend) => {
  it('has unique ids under its language prefix', () => {
    const ids = frontend.inventory.map(unit => unit.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids)
      expect(id.startsWith(`${frontend.language}/`)).toBe(true)
  })

  it('gives every unit a carrier, a reading and a chart cell', () => {
    for (const unit of frontend.inventory) {
      expect(unit.carrier).not.toBe('')
      expect(unit.reading).not.toBe('')
      expect(unit.chart.column).not.toBe('')
    }
  })

  it('puts at most one unit in each chart cell', () => {
    const cells = frontend.inventory.map(unit => `${unit.chart.row}|${unit.chart.column}`)
    expect(new Set(cells).size).toBe(cells.length)
  })
})

describe('inventories', () => {
  it('cover the expected syllables', () => {
    expect(zh.inventory).toHaveLength(402)
    expect(ja.inventory).toHaveLength(101)
    expect(ko.inventory).toHaveLength(19 * 17)
  })

  it('use plain pinyin ids and single-character carriers for Chinese', () => {
    for (const unit of zh.inventory) {
      expect(unit.id).toMatch(/^zh\/[a-z]+$/)
      expect([...unit.carrier]).toHaveLength(1)
    }
  })

  it('chart Chinese by initial and final', () => {
    const chart = (id: string) => zh.inventory.find(unit => unit.id === id)!.chart
    expect(chart('zh/zhuang')).toEqual({ row: 'zh', column: 'uang' })
    expect(chart('zh/xue')).toEqual({ row: 'x', column: 'üe' })
    expect(chart('zh/ng')).toEqual({ row: '', column: 'ng' })
  })

  it('chart Japanese on the gojūon grid', () => {
    const chart = (id: string) => ja.inventory.find(unit => unit.id === id)!.chart
    expect(chart('ja/shi')).toEqual({ row: 'さ', column: 'i' })
    expect(chart('ja/kyo')).toEqual({ row: 'きゃ', column: 'o' })
  })

  it('leave English to the Japanese bank', () => {
    expect(frontends.en.inventory).toEqual([])
  })
})
