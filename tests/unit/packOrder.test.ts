import { describe, expect, it } from 'vitest'
import type { ResourcePack } from '@core/types'
import { getDisplayOrderedPacks, reorderActivePacksByDisplayIndex } from '@packs/packOrder'

const makePack = (id: string, name: string): ResourcePack => ({
  meta: { id, name, version: '1.0.0', author: 'Test', description: name },
  source: 'builtin',
  path: `/${id}`,
  tokens: {},
  overrideCss: '',
  instruments: []
})

describe('packOrder', () => {
  it('displays active packs highest-priority-first and splits inactive packs alphabetically', () => {
    const packs = [
      makePack('base', 'Base Light'),
      makePack('dark', 'Dark Theme'),
      makePack('zeta', 'Zeta Extra'),
      makePack('alpha', 'Alpha Extra')
    ]

    // Merge order: base (lowest), dark (highest)
    const { active, inactive } = getDisplayOrderedPacks(packs, ['base', 'dark'])
    expect(active.map((p) => p.meta.id)).toEqual(['dark', 'base'])
    expect(inactive.map((p) => p.meta.id)).toEqual(['alpha', 'zeta'])
  })

  it('reorders activePackIds accurately from display drag indices', () => {
    // Merge order: [base, dark, custom] -> Display order: [custom (0), dark (1), base (2)]
    const activeIds = ['base', 'dark', 'custom']

    // Drag 'base' (display index 2) to top (display index 0)
    // Expected display: [base, custom, dark] -> Expected merge: [dark, custom, base]
    const reordered = reorderActivePacksByDisplayIndex(activeIds, 2, 0)
    expect(reordered).toEqual(['dark', 'custom', 'base'])
  })
})
