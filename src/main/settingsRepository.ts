import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { DEFAULT_SOUND_PACK_ID, DEFAULT_THEME_PACK_ID, type AppSettings } from '@core/types'

export interface WorkspacePaths {
  root: string
  projects: string
  exports: string
  themes: string
  sounds: string
}

export function getWorkspacePaths(workspaceDir: string): WorkspacePaths {
  return {
    root: workspaceDir,
    projects: join(workspaceDir, 'projects'),
    exports: join(workspaceDir, 'exports'),
    themes: join(workspaceDir, 'themes'),
    sounds: join(workspaceDir, 'sounds')
  }
}

export function ensureWorkspaceDirectories(workspaceDir: string): WorkspacePaths {
  const paths = getWorkspacePaths(workspaceDir)
  mkdirSync(paths.root, { recursive: true })
  mkdirSync(paths.projects, { recursive: true })
  mkdirSync(paths.exports, { recursive: true })
  mkdirSync(paths.themes, { recursive: true })
  mkdirSync(paths.sounds, { recursive: true })
  return paths
}

function normalizeThemePackIds(parsed: Partial<AppSettings>): string[] {
  if (Array.isArray(parsed.activeThemePackIds)) {
    const valid = parsed.activeThemePackIds.filter((x): x is string => typeof x === 'string')
    if (valid.length > 0) return Array.from(new Set(valid))
  }
  return [DEFAULT_THEME_PACK_ID]
}

function normalizeSoundPackIds(parsed: Partial<AppSettings>): string[] {
  const raw = Array.isArray(parsed.activeSoundPackIds)
    ? parsed.activeSoundPackIds.filter((x): x is string => typeof x === 'string')
    : []
  const withoutBase = raw.filter((id) => id !== DEFAULT_SOUND_PACK_ID)
  return [DEFAULT_SOUND_PACK_ID, ...Array.from(new Set(withoutBase))]
}

export class SettingsRepository {
  private readonly settingsFilePath: string
  private readonly defaultWorkspaceDir: string

  constructor(userDataDir: string, defaultWorkspaceDir: string) {
    this.settingsFilePath = join(userDataDir, 'settings.json')
    this.defaultWorkspaceDir = defaultWorkspaceDir
  }

  load(): AppSettings {
    const defaults: AppSettings = {
      workspaceDir: this.defaultWorkspaceDir,
      activeThemePackIds: [DEFAULT_THEME_PACK_ID],
      activeSoundPackIds: [DEFAULT_SOUND_PACK_ID],
      noteLengthMode: 'last-used',
      saveMode: 'auto'
    }
    if (!existsSync(this.settingsFilePath)) {
      ensureWorkspaceDirectories(defaults.workspaceDir)
      return defaults
    }
    try {
      const raw = readFileSync(this.settingsFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      const settings: AppSettings = {
        workspaceDir:
          typeof parsed.workspaceDir === 'string' && parsed.workspaceDir.trim().length > 0
            ? parsed.workspaceDir
            : defaults.workspaceDir,
        activeThemePackIds: normalizeThemePackIds(parsed),
        activeSoundPackIds: normalizeSoundPackIds(parsed),
        noteLengthMode:
          parsed.noteLengthMode === 'grid-step' || parsed.noteLengthMode === 'last-used'
            ? parsed.noteLengthMode
            : defaults.noteLengthMode,
        saveMode:
          parsed.saveMode === 'auto' || parsed.saveMode === 'manual'
            ? parsed.saveMode
            : defaults.saveMode
      }
      ensureWorkspaceDirectories(settings.workspaceDir)
      return settings
    } catch {
      ensureWorkspaceDirectories(defaults.workspaceDir)
      return defaults
    }
  }

  save(settings: AppSettings): AppSettings {
    ensureWorkspaceDirectories(settings.workspaceDir)
    mkdirSync(dirname(this.settingsFilePath), { recursive: true })
    writeFileSync(this.settingsFilePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8')
    return settings
  }
}
