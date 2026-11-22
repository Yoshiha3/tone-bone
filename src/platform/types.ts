import type { AppSettings, ResourcePack } from '@core/types'

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
}

export interface OpenFileResult {
  canceled: boolean
  filePath?: string
  content?: string
}

export interface PlatformAdapter {
  saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult>
  writeProjectFile(filePath: string, content: string): Promise<SaveFileResult>
  openProjectFile(): Promise<OpenFileResult>
  saveWavFile(suggestedName: string, data: Uint8Array): Promise<SaveFileResult>
  loadSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  chooseWorkspaceDir(): Promise<string | null>
  openFolder(target: 'workspace' | 'projects' | 'exports' | 'packs'): Promise<void>
  listResourcePacks(): Promise<ResourcePack[]>
}
