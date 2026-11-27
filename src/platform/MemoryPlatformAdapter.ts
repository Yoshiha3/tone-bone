import {
  DEFAULT_NOTE_DRAW_KEY,
  DEFAULT_NOTE_INPUT_MODE,
  DEFAULT_SOUND_PACK_ID,
  DEFAULT_THEME_PACK_ID,
  type AppSettings,
  type ProjectSummary,
  type SoundPack,
  type ThemePack
} from '@core/types'
import type {
  ExportFileOptions,
  OpenFileResult,
  OpenProjectFileOptions,
  PlatformAdapter,
  SaveFileResult,
  SaveProjectFileOptions
} from './types'

interface StoredMemoryProject {
  content: string
  updatedAtMs: number
}

function sanitizeFileName(raw: string): string {
  const cleaned = raw.trim().replace(/[\\/:*?"<>|]/g, '_')
  return cleaned.length > 0 ? cleaned : 'Untitled'
}

function summarizeMemoryProject(
  filePath: string,
  entry: StoredMemoryProject
): ProjectSummary | null {
  try {
    const parsed = JSON.parse(entry.content) as Record<string, unknown>
    if (
      parsed.format !== 'tone-bone/v1' ||
      typeof parsed.title !== 'string' ||
      typeof parsed.bpm !== 'number' ||
      typeof parsed.bars !== 'number' ||
      !Array.isArray(parsed.tracks)
    ) {
      return null
    }
    const parts = filePath.split('/')
    return {
      filePath,
      fileName: parts[parts.length - 1] ?? filePath,
      title: parsed.title,
      bpm: parsed.bpm,
      bars: parsed.bars,
      trackCount: parsed.tracks.length,
      updatedAtMs: entry.updatedAtMs
    }
  } catch {
    return null
  }
}

export class MemoryPlatformAdapter implements PlatformAdapter {
  lastSavedProjectContent: string | null = null
  lastSavedProjectPath: string | null = null
  lastSaveProjectFilters: SaveProjectFileOptions['filters'] | null = null
  lastOpenProjectFilters: OpenProjectFileOptions['filters'] | null = null
  lastSavedExportBytes: Uint8Array | null = null
  lastSavedExportPath: string | null = null
  lastSavedExportExtension: string | null = null
  saveDialogCount = 0
  directWriteCount = 0
  settings: AppSettings
  themePacks: ThemePack[]
  soundPacks: SoundPack[]
  private workspaceFiles = new Map<string, StoredMemoryProject>()
  private clock = 1_700_000_000_000

  constructor(
    initialThemePacks: ThemePack[] = [],
    initialSoundPacks: SoundPack[] = [],
    initialSettings: AppSettings = {
      workspaceDir: '/memory/ToneBone',
      activeThemePackIds: [DEFAULT_THEME_PACK_ID],
      activeSoundPackIds: [DEFAULT_SOUND_PACK_ID],
      noteLengthMode: 'last-used',
      noteInputMode: DEFAULT_NOTE_INPUT_MODE,
      noteDrawKey: DEFAULT_NOTE_DRAW_KEY,
      saveMode: 'auto'
    }
  ) {
    this.themePacks = initialThemePacks
    this.soundPacks = initialSoundPacks
    this.settings = initialSettings
  }

  private nextTimestamp(): number {
    this.clock += 1000
    return this.clock
  }

  async saveProjectFile(options: SaveProjectFileOptions): Promise<SaveFileResult> {
    this.saveDialogCount++
    this.lastSaveProjectFilters = options.filters
    const filePath = `${this.settings.workspaceDir}/projects/${options.suggestedName}`
    this.lastSavedProjectPath = filePath
    this.lastSavedProjectContent = options.content
    this.workspaceFiles.set(filePath, {
      content: options.content,
      updatedAtMs: this.nextTimestamp()
    })
    return { canceled: false, filePath }
  }

  async writeProjectFile(filePath: string, content: string): Promise<SaveFileResult> {
    this.directWriteCount++
    this.lastSavedProjectPath = filePath
    this.lastSavedProjectContent = content
    this.workspaceFiles.set(filePath, { content, updatedAtMs: this.nextTimestamp() })
    return { canceled: false, filePath }
  }

  async openProjectFile(options: OpenProjectFileOptions): Promise<OpenFileResult> {
    this.lastOpenProjectFilters = options.filters
    if (this.lastSavedProjectContent === null) {
      return { canceled: true }
    }
    return {
      canceled: false,
      filePath: this.lastSavedProjectPath ?? undefined,
      content: this.lastSavedProjectContent
    }
  }

  async saveExportFile(options: ExportFileOptions): Promise<SaveFileResult> {
    const filePath = `${this.settings.workspaceDir}/exports/${options.suggestedName}`
    this.lastSavedExportBytes = options.data
    this.lastSavedExportPath = filePath
    this.lastSavedExportExtension = options.extension
    return { canceled: false, filePath }
  }

  async loadSettings(): Promise<AppSettings> {
    return {
      ...this.settings,
      activeThemePackIds: [...this.settings.activeThemePackIds],
      activeSoundPackIds: [...this.settings.activeSoundPackIds]
    }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    this.settings = {
      ...settings,
      activeThemePackIds: [...settings.activeThemePackIds],
      activeSoundPackIds: [...settings.activeSoundPackIds]
    }
    return this.loadSettings()
  }

  async chooseWorkspaceDir(): Promise<string | null> {
    return '/memory/CustomWorkspace'
  }

  async openFolder(): Promise<void> {
    // No-op in memory adapter
  }

  async listThemePacks(): Promise<ThemePack[]> {
    return this.themePacks
  }

  async listSoundPacks(): Promise<SoundPack[]> {
    return this.soundPacks
  }

  async listWorkspaceProjects(): Promise<ProjectSummary[]> {
    const prefix = `${this.settings.workspaceDir}/projects/`
    const results: ProjectSummary[] = []
    for (const [filePath, entry] of this.workspaceFiles.entries()) {
      if (!filePath.startsWith(prefix)) continue
      const summary = summarizeMemoryProject(filePath, entry)
      if (summary) results.push(summary)
    }
    return results.sort((a, b) => b.updatedAtMs - a.updatedAtMs)
  }

  async readWorkspaceProject(filePath: string): Promise<OpenFileResult> {
    const entry = this.workspaceFiles.get(filePath)
    if (!entry) return { canceled: true }
    return { canceled: false, filePath, content: entry.content }
  }

  async createWorkspaceProject(baseTitle: string, content: string): Promise<ProjectSummary> {
    const base = baseTitle.trim() || 'Untitled'
    const dir = `${this.settings.workspaceDir}/projects`
    let title = base
    let filePath = `${dir}/${sanitizeFileName(title)}.json`
    for (let suffix = 2; this.workspaceFiles.has(filePath); suffix++) {
      title = `${base} ${suffix}`
      filePath = `${dir}/${sanitizeFileName(title)}.json`
    }
    const parsed = JSON.parse(content) as Record<string, unknown>
    const updatedContent = `${JSON.stringify({ ...parsed, title }, null, 2)}\n`
    const entry = { content: updatedContent, updatedAtMs: this.nextTimestamp() }
    this.workspaceFiles.set(filePath, entry)
    this.lastSavedProjectPath = filePath
    this.lastSavedProjectContent = updatedContent
    const summary = summarizeMemoryProject(filePath, entry)
    if (!summary) throw new Error('Invalid project content')
    return summary
  }

  async renameWorkspaceProject(filePath: string, newTitle: string): Promise<ProjectSummary> {
    const trimmed = newTitle.trim()
    if (!trimmed) throw new Error('曲名を入力してください')
    const existing = this.workspaceFiles.get(filePath)
    if (!existing) throw new Error('対象のプロジェクトファイルが見つかりません')

    const dir = filePath.slice(0, filePath.lastIndexOf('/'))
    const targetPath = `${dir}/${sanitizeFileName(trimmed)}.json`
    const isSame = filePath === targetPath
    const isCaseOnly = !isSame && filePath.toLowerCase() === targetPath.toLowerCase()

    if (!isSame && !isCaseOnly) {
      for (const existingPath of this.workspaceFiles.keys()) {
        if (existingPath.toLowerCase() === targetPath.toLowerCase()) {
          throw new Error(`同名のプロジェクト「${trimmed}」がすでに存在します`)
        }
      }
    }

    const parsed = JSON.parse(existing.content) as Record<string, unknown>
    const updatedContent = `${JSON.stringify({ ...parsed, title: trimmed }, null, 2)}\n`
    const entry = { content: updatedContent, updatedAtMs: this.nextTimestamp() }
    if (!isSame) this.workspaceFiles.delete(filePath)
    this.workspaceFiles.set(targetPath, entry)
    if (this.lastSavedProjectPath === filePath) {
      this.lastSavedProjectPath = targetPath
      this.lastSavedProjectContent = updatedContent
    }
    const summary = summarizeMemoryProject(targetPath, entry)
    if (!summary) throw new Error('Invalid project content')
    return summary
  }

  async duplicateWorkspaceProject(filePath: string): Promise<ProjectSummary> {
    const existing = this.workspaceFiles.get(filePath)
    if (!existing) throw new Error('対象のプロジェクトファイルが見つかりません')
    const parsed = JSON.parse(existing.content) as Record<string, unknown>
    const origTitle = typeof parsed.title === 'string' ? parsed.title : 'Untitled'
    return this.createWorkspaceProject(`${origTitle} Copy`, existing.content)
  }

  async deleteWorkspaceProject(filePath: string): Promise<void> {
    this.workspaceFiles.delete(filePath)
    if (this.lastSavedProjectPath === filePath) {
      this.lastSavedProjectPath = null
      this.lastSavedProjectContent = null
    }
  }
}
