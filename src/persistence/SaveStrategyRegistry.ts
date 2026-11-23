import type { SaveMode } from '@core/types'
import { DebouncedAutoSaveStrategy } from './DebouncedAutoSaveStrategy'
import { ManualSaveStrategy } from './ManualSaveStrategy'
import type { SaveStrategy } from './types'

export class SaveStrategyRegistry {
  private readonly strategies = new Map<SaveMode, SaveStrategy>()
  private defaultId: SaveMode | null = null

  register(strategy: SaveStrategy, setAsDefault = false): void {
    this.strategies.set(strategy.id, strategy)
    if (setAsDefault || this.defaultId === null) {
      this.defaultId = strategy.id
    }
  }

  get(id: SaveMode): SaveStrategy {
    const found = this.strategies.get(id)
    if (found) return found
    if (this.defaultId) {
      const fallback = this.strategies.get(this.defaultId)
      if (fallback) return fallback
    }
    throw new Error(`No save strategy registered for mode: ${id}`)
  }

  list(): SaveStrategy[] {
    return Array.from(this.strategies.values())
  }

  disposeAll(): void {
    for (const strategy of this.strategies.values()) {
      strategy.dispose()
    }
  }
}

export function createDefaultSaveStrategyRegistry(autoSaveDelayMs = 1200): SaveStrategyRegistry {
  const registry = new SaveStrategyRegistry()
  registry.register(new DebouncedAutoSaveStrategy(autoSaveDelayMs), true)
  registry.register(new ManualSaveStrategy())
  return registry
}
