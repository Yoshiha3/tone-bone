import {
  DEFAULT_SOUND_PACK_ID,
  DEFAULT_THEME_PACK_ID,
  type InstrumentDef,
  type MergedSoundConfig,
  type MergedThemeConfig,
  type SoundPack,
  type ThemePack,
  type VisualizerPreset
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
 * Merges active theme packs in order (lowest -> highest priority).
 * Later packs override CSS tokens and visualizer fields while concatenating override CSS.
 */
export function mergeThemePacks(
  allPacks: readonly ThemePack[],
  activeThemePackIds: readonly string[],
  fallbackThemeId = DEFAULT_THEME_PACK_ID
): MergedThemeConfig {
  const byId = new Map(allPacks.map((p) => [p.meta.id, p]))
  const orderedPacks: ThemePack[] = []
  const seen = new Set<string>()

  for (const id of activeThemePackIds) {
    const pack = byId.get(id)
    if (pack && !seen.has(id)) {
      orderedPacks.push(pack)
      seen.add(id)
    }
  }

  if (orderedPacks.length === 0 && allPacks.length > 0) {
    const fallback = byId.get(fallbackThemeId) ?? allPacks[0]
    orderedPacks.push(fallback)
  }

  const tokens: Record<string, string> = {}
  const cssParts: string[] = []
  let visualizer: VisualizerPreset = { ...FALLBACK_VISUALIZER_PRESET }

  for (const pack of orderedPacks) {
    Object.assign(tokens, pack.tokens)
    if (pack.overrideCss.trim().length > 0) {
      cssParts.push(`/* Theme Pack: ${pack.meta.id} */\n${pack.overrideCss}`)
    }
    if (pack.visualizer) {
      visualizer = {
        ...visualizer,
        ...pack.visualizer
      }
    }
  }

  return {
    activeThemePackIds: orderedPacks.map((p) => p.meta.id),
    tokens,
    overrideCss: cssParts.join('\n\n'),
    visualizer
  }
}

/**
 * Merges active sound packs in order (lowest -> highest priority).
 * When `baseSoundPackId` exists in `allPacks`, it is ALWAYS pinned as the lowest base layer
 * so standard instruments and drum kits can never disappear when toggling packs or themes.
 */
export function mergeSoundPacks(
  allPacks: readonly SoundPack[],
  activeSoundPackIds: readonly string[],
  baseSoundPackId = DEFAULT_SOUND_PACK_ID
): MergedSoundConfig {
  const byId = new Map(allPacks.map((p) => [p.meta.id, p]))
  const orderedPacks: SoundPack[] = []
  const seen = new Set<string>()

  const basePack = byId.get(baseSoundPackId)
  if (basePack) {
    orderedPacks.push(basePack)
    seen.add(basePack.meta.id)
  }

  for (const id of activeSoundPackIds) {
    const pack = byId.get(id)
    if (pack && !seen.has(id)) {
      orderedPacks.push(pack)
      seen.add(id)
    }
  }

  if (orderedPacks.length === 0 && allPacks.length > 0) {
    orderedPacks.push(allPacks[0])
  }

  const instrumentMap = new Map<string, InstrumentDef>()
  for (const pack of orderedPacks) {
    for (const inst of pack.instruments) {
      instrumentMap.set(inst.id, inst)
    }
  }

  return {
    activeSoundPackIds: orderedPacks.map((p) => p.meta.id),
    instruments: Array.from(instrumentMap.values())
  }
}
