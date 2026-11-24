import type {
  AppSettings,
  ProjectSummary,
  SoundPack,
  ThemePack,
  WorkspaceFolderTarget
} from '@core/types'
import type { ExportFileOptions, OpenFileResult, PlatformAdapter, SaveFileResult } from './types'

declare global {
  interface Window {
    tonebone?: PlatformAdapter
  }
}

export class ElectronPlatformAdapter implements PlatformAdapter {
  private get bridge(): PlatformAdapter {
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

  saveExportFile(options: ExportFileOptions): Promise<SaveFileResult> {
    return this.bridge.saveExportFile(options)
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

  openFolder(target: WorkspaceFolderTarget): Promise<void> {
    return this.bridge.openFolder(target)
  }

  listThemePacks(): Promise<ThemePack[]> {
    return this.bridge.listThemePacks()
  }

  listSoundPacks(): Promise<SoundPack[]> {
    return this.bridge.listSoundPacks()
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
