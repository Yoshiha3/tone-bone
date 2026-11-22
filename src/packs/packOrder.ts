import type { ResourcePack } from '@core/types'

export interface DisplayOrderedPacks {
  /** Active packs ordered highest priority first (index 0 = top of list = highest override) */
  active: ResourcePack[]
  /** Inactive packs ordered alphabetically by name */
  inactive: ResourcePack[]
}

/**
 * Splits packs into active (top = highest priority) and inactive groups.
 * Note: Internal `activePackIds` is stored in merge order (lowest -> highest),
 * so display order is the reverse of `activePackIds`.
 */
export function getDisplayOrderedPacks(
  allPacks: readonly ResourcePack[],
  activePackIds: readonly string[]
): DisplayOrderedPacks {
  const byId = new Map(allPacks.map((p) => [p.meta.id, p]))
  const activeSet = new Set<string>()
  const active: ResourcePack[] = []

  // Reverse activePackIds so index 0 is highest priority (top of list)
  for (let i = activePackIds.length - 1; i >= 0; i--) {
    const id = activePackIds[i]
    const pack = byId.get(id)
    if (pack && !activeSet.has(id)) {
      active.push(pack)
      activeSet.add(id)
    }
  }

  const inactive = allPacks
    .filter((p) => !activeSet.has(p.meta.id))
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name))

  return { active, inactive }
}

/**
 * Reorders `activePackIds` (merge order: lowest -> highest) based on a drag-and-drop
 * move in display order (index 0 = top = highest priority).
 */
export function reorderActivePacksByDisplayIndex(
  activePackIds: readonly string[],
  fromDisplayIndex: number,
  toDisplayIndex: number
): string[] {
  const display = [...activePackIds].reverse()
  if (
    fromDisplayIndex < 0 ||
    fromDisplayIndex >= display.length ||
    toDisplayIndex < 0 ||
    toDisplayIndex >= display.length ||
    fromDisplayIndex === toDisplayIndex
  ) {
    return [...activePackIds]
  }

  const [moved] = display.splice(fromDisplayIndex, 1)
  display.splice(toDisplayIndex, 0, moved)
  return display.reverse()
}
