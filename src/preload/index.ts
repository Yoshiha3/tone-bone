import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '@core/types'

contextBridge.exposeInMainWorld('tonebone', {
  saveProjectFile: (suggestedName: string, content: string) =>
    ipcRenderer.invoke('project:save', suggestedName, content),
  openProjectFile: () => ipcRenderer.invoke('project:open'),
  saveWavFile: (suggestedName: string, data: Uint8Array) =>
    ipcRenderer.invoke('audio:saveWav', suggestedName, data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  chooseWorkspaceDir: () => ipcRenderer.invoke('workspace:choose'),
  openFolder: (target: 'workspace' | 'projects' | 'exports' | 'packs') =>
    ipcRenderer.invoke('workspace:openFolder', target),
  listResourcePacks: () => ipcRenderer.invoke('packs:list')
})
