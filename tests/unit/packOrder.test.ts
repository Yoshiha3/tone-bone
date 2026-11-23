import { describe, expect, it } from 'vitest'
import type { BasePack } from '@core/types'
import { getDisplayOrderedPacks, reorderActivePacksByDisplayIndex } from '@packs/packOrder'

const makePack = (id: string, name: string): BasePack => ({
  meta: { id, name, version: '1.0.0', author: 'Test', description: name },
  source: 'builtin',
  path: `/${id}`
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

  it('reorders activePackIds accurately from display drag indices and respects pinnedBaseId', () => {
    // Merge order: [base, dark, custom] -> Display order: [custom (0), dark (1), base (2)]
    const activeIds = ['base', 'dark', 'custom']

    const reordered = reorderActivePacksByDisplayIndex(activeIds, 2, 0)
    expect(reordered).toEqual(['dark', 'custom', 'base'])

    // Moving pinned base (display index 2) or dropping onto pinned base is a no-op
    expect(reorderActivePacksByDisplayIndex(activeIds, 2, 0, 'base')).toEqual(activeIds)
    expect(reorderActivePacksByDisplayIndex(activeIds, 0, 2, 'base')).toEqual(activeIds)
    // Moving non-pinned overlays relative to each other still succeeds
    expect(reorderActivePacksByDisplayIndex(activeIds, 0, 1, 'base')).toEqual([
      'base',
      'custom',
      'dark'
    ])
  })
})
