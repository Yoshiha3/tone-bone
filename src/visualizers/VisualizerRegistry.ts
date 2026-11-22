import { MinimalFlowRenderer } from './MinimalFlowRenderer'
import type { VisualizerRenderer } from './types'

export class VisualizerRegistry {
  private readonly renderers = new Map<string, VisualizerRenderer>()
  private defaultId: string | null = null

  register(renderer: VisualizerRenderer, setAsDefault = false): void {
    this.renderers.set(renderer.id, renderer)
    if (setAsDefault || this.defaultId === null) {
      this.defaultId = renderer.id
    }
  }

  get(id: string): VisualizerRenderer {
    const found = this.renderers.get(id)
    if (found) return found
    if (this.defaultId) {
      const fallback = this.renderers.get(this.defaultId)
      if (fallback) return fallback
    }
    throw new Error(`No visualizer renderer available for id: ${id}`)
  }

  list(): VisualizerRenderer[] {
    return Array.from(this.renderers.values())
  }
}

export function createDefaultVisualizerRegistry(): VisualizerRegistry {
  const registry = new VisualizerRegistry()
  registry.register(new MinimalFlowRenderer(), true)
  return registry
}
