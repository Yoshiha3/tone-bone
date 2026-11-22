import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type {
  InstrumentDef,
  PackMetadata,
  ResourcePack,
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

function readTextIfExists(filePath: string): string {
  if (!existsSync(filePath)) return ''
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export function loadPacksFromDirectory(
  directory: string,
  source: 'builtin' | 'user'
): ResourcePack[] {
  if (!existsSync(directory)) return []

  const entries = readdirSync(directory, { withFileTypes: true })
  const packs: ResourcePack[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const packDir = join(directory, entry.name)
    const meta = readJsonIfExists<PackMetadata>(join(packDir, 'pack.json'))
    if (!meta || typeof meta.id !== 'string' || typeof meta.name !== 'string') {
      continue
    }

    const tokens = readJsonIfExists<Record<string, string>>(join(packDir, 'theme', 'tokens.json')) ?? {}
    const overrideCss = readTextIfExists(join(packDir, 'theme', 'override.css'))
    const visualizer = readJsonIfExists<Partial<VisualizerPreset>>(
      join(packDir, 'visualizer', 'preset.json')
    )
    const instruments =
      readJsonIfExists<InstrumentDef[]>(join(packDir, 'sounds', 'instruments.json')) ?? []

    packs.push({
      meta,
      source,
      path: packDir,
      tokens,
      overrideCss,
      visualizer,
      instruments
    })
  }

  return packs.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
}

export function loadAllResourcePacks(builtinDir: string, userPacksDir: string): ResourcePack[] {
  const builtin = loadPacksFromDirectory(builtinDir, 'builtin')
  const user = loadPacksFromDirectory(userPacksDir, 'user')

  // User packs with the same ID can replace builtin packs if desired
  const map = new Map<string, ResourcePack>()
  for (const p of builtin) map.set(p.meta.id, p)
  for (const p of user) map.set(p.meta.id, p)
  return Array.from(map.values())
}
