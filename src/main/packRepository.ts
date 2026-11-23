import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type {
  InstrumentDef,
  PackMetadata,
  SoundPack,
  ThemePack,
  VisualizerPreset
} from '@core/types'

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return undefined
  }
}

function readFirstJson<T>(paths: readonly string[]): T | undefined {
  for (const p of paths) {
    const val = readJsonIfExists<T>(p)
    if (val !== undefined) return val
  }
  return undefined
}

function readFirstText(paths: readonly string[]): string {
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      continue
    }
  }
  return ''
}

export function loadThemePacksFromDirectory(
  directory: string,
  source: 'builtin' | 'user'
): ThemePack[] {
  if (!existsSync(directory)) return []

  const entries = readdirSync(directory, { withFileTypes: true })
  const packs: ThemePack[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const packDir = join(directory, entry.name)
    const meta = readJsonIfExists<PackMetadata>(join(packDir, 'pack.json'))
    if (!meta || typeof meta.id !== 'string' || typeof meta.name !== 'string') {
      continue
    }

    const tokens =
      readFirstJson<Record<string, string>>([
        join(packDir, 'tokens.json'),
        join(packDir, 'theme', 'tokens.json')
      ]) ?? {}
    const overrideCss = readFirstText([
      join(packDir, 'override.css'),
      join(packDir, 'theme', 'override.css')
    ])
    const visualizer = readFirstJson<Partial<VisualizerPreset>>([
      join(packDir, 'visualizer.json'),
      join(packDir, 'visualizer', 'preset.json')
    ])

    packs.push({
      meta,
      source,
      path: packDir,
      tokens,
      overrideCss,
      visualizer
    })
  }

  return packs.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
}

export function loadSoundPacksFromDirectory(
  directory: string,
  source: 'builtin' | 'user'
): SoundPack[] {
  if (!existsSync(directory)) return []

  const entries = readdirSync(directory, { withFileTypes: true })
  const packs: SoundPack[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const packDir = join(directory, entry.name)
    const meta = readJsonIfExists<PackMetadata>(join(packDir, 'pack.json'))
    if (!meta || typeof meta.id !== 'string' || typeof meta.name !== 'string') {
      continue
    }

    const instruments =
      readFirstJson<InstrumentDef[]>([
        join(packDir, 'instruments.json'),
        join(packDir, 'sounds', 'instruments.json')
      ]) ?? []

    packs.push({
      meta,
      source,
      path: packDir,
      instruments
    })
  }

  return packs.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
}

export function loadAllThemePacks(builtinDir: string, userThemesDir: string): ThemePack[] {
  const builtin = loadThemePacksFromDirectory(builtinDir, 'builtin')
  const user = loadThemePacksFromDirectory(userThemesDir, 'user')

  // User packs with the same ID can replace builtin packs if desired
  const map = new Map<string, ThemePack>()
  for (const p of builtin) map.set(p.meta.id, p)
  for (const p of user) map.set(p.meta.id, p)
  return Array.from(map.values())
}

export function loadAllSoundPacks(builtinDir: string, userSoundsDir: string): SoundPack[] {
  const builtin = loadSoundPacksFromDirectory(builtinDir, 'builtin')
  const user = loadSoundPacksFromDirectory(userSoundsDir, 'user')

  // User packs with the same ID can replace builtin packs if desired
  const map = new Map<string, SoundPack>()
  for (const p of builtin) map.set(p.meta.id, p)
  for (const p of user) map.set(p.meta.id, p)
  return Array.from(map.values())
}
