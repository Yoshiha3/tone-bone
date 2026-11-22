import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '@core/types'

export interface WorkspacePaths {
  root: string
  projects: string
  exports: string
  packs: string
}

export function getWorkspacePaths(workspaceDir: string): WorkspacePaths {
  return {
    root: workspaceDir,
    projects: join(workspaceDir, 'projects'),
    exports: join(workspaceDir, 'exports'),
    packs: join(workspaceDir, 'packs')
  }
}

export function ensureWorkspaceDirectories(workspaceDir: string): WorkspacePaths {
  const paths = getWorkspacePaths(workspaceDir)
  mkdirSync(paths.root, { recursive: true })
  mkdirSync(paths.projects, { recursive: true })
  mkdirSync(paths.exports, { recursive: true })
  mkdirSync(paths.packs, { recursive: true })
  return paths
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
      activePackIds: ['default-minimal'],
      noteLengthMode: 'last-used'
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
        activePackIds:
          Array.isArray(parsed.activePackIds) && parsed.activePackIds.length > 0
            ? parsed.activePackIds.filter((x): x is string => typeof x === 'string')
            : defaults.activePackIds,
        noteLengthMode:
          parsed.noteLengthMode === 'grid-step' || parsed.noteLengthMode === 'last-used'
            ? parsed.noteLengthMode
            : defaults.noteLengthMode
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
    writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
    return settings
  }
}
