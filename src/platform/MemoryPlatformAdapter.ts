import type { AppSettings, ResourcePack } from '@core/types'
import type { OpenFileResult, PlatformAdapter, SaveFileResult } from './types'

export class MemoryPlatformAdapter implements PlatformAdapter {
  lastSavedProjectContent: string | null = null
  lastSavedProjectPath: string | null = null
  lastSavedWavBytes: Uint8Array | null = null
  settings: AppSettings
  packs: ResourcePack[]

  constructor(
    initialPacks: ResourcePack[] = [],
    initialSettings: AppSettings = {
      workspaceDir: '/memory/ToneBone',
      activePackIds: ['default-minimal'],
      noteLengthMode: 'last-used'
    }
  ) {
    this.packs = initialPacks
    this.settings = initialSettings
  }

  async saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult> {
    const filePath = `${this.settings.workspaceDir}/projects/${suggestedName}`
    this.lastSavedProjectPath = filePath
    this.lastSavedProjectContent = content
    return { canceled: false, filePath }
  }

  async openProjectFile(): Promise<OpenFileResult> {
    if (this.lastSavedProjectContent === null) {
      return { canceled: true }
    }
    return {
      canceled: false,
      filePath: this.lastSavedProjectPath ?? undefined,
      content: this.lastSavedProjectContent
    }
  }

  async saveWavFile(suggestedName: string, data: Uint8Array): Promise<SaveFileResult> {
    this.lastSavedWavBytes = data
    return { canceled: false, filePath: `${this.settings.workspaceDir}/exports/${suggestedName}` }
  }

  async loadSettings(): Promise<AppSettings> {
    return { ...this.settings, activePackIds: [...this.settings.activePackIds] }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    this.settings = { ...settings, activePackIds: [...settings.activePackIds] }
    return this.loadSettings()
  }

  async chooseWorkspaceDir(): Promise<string | null> {
    return '/memory/CustomWorkspace'
  }

  async openFolder(): Promise<void> {
    // No-op in memory adapter
  }

  async listResourcePacks(): Promise<ResourcePack[]> {
    return this.packs
  }
}
