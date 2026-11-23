import type { AppSettings, ProjectSummary, ResourcePack } from '@core/types'
import type { OpenFileResult, PlatformAdapter, SaveFileResult } from './types'

declare global {
  interface Window {
    tonebone?: {
      saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult>
      writeProjectFile(filePath: string, content: string): Promise<SaveFileResult>
      openProjectFile(): Promise<OpenFileResult>
      saveWavFile(suggestedName: string, data: Uint8Array): Promise<SaveFileResult>
      loadSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<AppSettings>
      chooseWorkspaceDir(): Promise<string | null>
      openFolder(target: 'workspace' | 'projects' | 'exports' | 'packs'): Promise<void>
      listResourcePacks(): Promise<ResourcePack[]>
      listWorkspaceProjects(): Promise<ProjectSummary[]>
      readWorkspaceProject(filePath: string): Promise<OpenFileResult>
      createWorkspaceProject(baseTitle: string, content: string): Promise<ProjectSummary>
      renameWorkspaceProject(filePath: string, newTitle: string): Promise<ProjectSummary>
      duplicateWorkspaceProject(filePath: string): Promise<ProjectSummary>
      deleteWorkspaceProject(filePath: string): Promise<void>
    }
  }
}

export class ElectronPlatformAdapter implements PlatformAdapter {
  private get bridge() {
    if (typeof window === 'undefined' || !window.tonebone) {
      throw new Error('Electron preload bridge (window.tonebone) is not available')
    }
    return window.tonebone
  }

  saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult> {
    return this.bridge.saveProjectFile(suggestedName, content)
  }

  writeProjectFile(filePath: string, content: string): Promise<SaveFileResult> {
    return this.bridge.writeProjectFile(filePath, content)
  }

  openProjectFile(): Promise<OpenFileResult> {
    return this.bridge.openProjectFile()
  }

  saveWavFile(suggestedName: string, data: Uint8Array): Promise<SaveFileResult> {
    return this.bridge.saveWavFile(suggestedName, data)
  }

  loadSettings(): Promise<AppSettings> {
    return this.bridge.loadSettings()
  }

  saveSettings(settings: AppSettings): Promise<AppSettings> {
    return this.bridge.saveSettings(settings)
  }

  chooseWorkspaceDir(): Promise<string | null> {
    return this.bridge.chooseWorkspaceDir()
  }

  openFolder(target: 'workspace' | 'projects' | 'exports' | 'packs'): Promise<void> {
    return this.bridge.openFolder(target)
  }

  listResourcePacks(): Promise<ResourcePack[]> {
    return this.bridge.listResourcePacks()
  }

  listWorkspaceProjects(): Promise<ProjectSummary[]> {
    return this.bridge.listWorkspaceProjects()
  }

  readWorkspaceProject(filePath: string): Promise<OpenFileResult> {
    return this.bridge.readWorkspaceProject(filePath)
  }

  createWorkspaceProject(baseTitle: string, content: string): Promise<ProjectSummary> {
    return this.bridge.createWorkspaceProject(baseTitle, content)
  }

  renameWorkspaceProject(filePath: string, newTitle: string): Promise<ProjectSummary> {
    return this.bridge.renameWorkspaceProject(filePath, newTitle)
  }

  duplicateWorkspaceProject(filePath: string): Promise<ProjectSummary> {
    return this.bridge.duplicateWorkspaceProject(filePath)
  }

  deleteWorkspaceProject(filePath: string): Promise<void> {
    return this.bridge.deleteWorkspaceProject(filePath)
  }
}
