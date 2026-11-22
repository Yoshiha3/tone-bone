import type {
  InstrumentDef,
  MergedPackConfig,
  ResourcePack,
  VisualizerPreset
} from '@core/types'

export const FALLBACK_VISUALIZER_PRESET: VisualizerPreset = {
  rendererId: 'minimal-flow',
  background: '#f6f7f9',
  waveColor: '#3b6ea5',
  gridColor: '#e2e6ed',
  noteOpacity: 0.9,
  rippleScale: 1.0,
  showWaveform: true
}

/**
 * Merges active resource packs in order (like Minecraft resource pack layering).
 * Later packs in `activePackIds` override tokens, visualizer fields, and instruments
 * from earlier packs, while concatenating optional override CSS.
 */
export function mergeResourcePacks(
  allPacks: readonly ResourcePack[],
  activePackIds: readonly string[]
): MergedPackConfig {
  const byId = new Map(allPacks.map((p) => [p.meta.id, p]))
  const orderedPacks: ResourcePack[] = []

  for (const id of activePackIds) {
    const pack = byId.get(id)
    if (pack) orderedPacks.push(pack)
  }

  // Always guarantee at least the first available pack if none matched
  if (orderedPacks.length === 0 && allPacks.length > 0) {
    orderedPacks.push(allPacks[0])
  }

  const tokens: Record<string, string> = {}
  const cssParts: string[] = []
  const instrumentMap = new Map<string, InstrumentDef>()
  let visualizer: VisualizerPreset = { ...FALLBACK_VISUALIZER_PRESET }

  for (const pack of orderedPacks) {
    Object.assign(tokens, pack.tokens)
    if (pack.overrideCss.trim().length > 0) {
      cssParts.push(`/* Pack: ${pack.meta.id} */\n${pack.overrideCss}`)
    }
    if (pack.visualizer) {
      visualizer = {
        ...visualizer,
        ...pack.visualizer
      }
    }
    for (const inst of pack.instruments) {
      instrumentMap.set(inst.id, inst)
    }
  }

  return {
    activePackIds: orderedPacks.map((p) => p.meta.id),
    tokens,
    overrideCss: cssParts.join('\n\n'),
    visualizer,
    instruments: Array.from(instrumentMap.values())
  }
}
