import type { AppSettings, ResourcePack } from '@core/types'
import type { OpenFileResult, PlatformAdapter, SaveFileResult } from './types'

declare global {
  interface Window {
    tonebone?: {
      saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult>
      openProjectFile(): Promise<OpenFileResult>
      saveWavFile(suggestedName: string, data: Uint8Array): Promise<SaveFileResult>
      loadSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<AppSettings>
      chooseWorkspaceDir(): Promise<string | null>
      openFolder(target: 'workspace' | 'projects' | 'exports' | 'packs'): Promise<void>
      listResourcePacks(): Promise<ResourcePack[]>
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
}
