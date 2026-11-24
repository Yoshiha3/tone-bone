import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, WorkspaceFolderTarget } from '@core/types'
import type {
  ExportFileOptions,
  OpenProjectFileOptions,
  SaveProjectFileOptions
} from '@platform/types'

contextBridge.exposeInMainWorld('tonebone', {
  saveProjectFile: (options: SaveProjectFileOptions) =>
    ipcRenderer.invoke('project:save', options),
  writeProjectFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('project:write', filePath, content),
  openProjectFile: (options: OpenProjectFileOptions) =>
    ipcRenderer.invoke('project:open', options),
  saveExportFile: (options: ExportFileOptions) => ipcRenderer.invoke('audio:saveExport', options),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  chooseWorkspaceDir: () => ipcRenderer.invoke('workspace:choose'),
  openFolder: (target: WorkspaceFolderTarget) =>
    ipcRenderer.invoke('workspace:openFolder', target),
  listThemePacks: () => ipcRenderer.invoke('packs:listThemes'),
  listSoundPacks: () => ipcRenderer.invoke('packs:listSounds'),
  listWorkspaceProjects: () => ipcRenderer.invoke('projects:list'),
  readWorkspaceProject: (filePath: string) => ipcRenderer.invoke('projects:read', filePath),
  createWorkspaceProject: (baseTitle: string, content: string) =>
    ipcRenderer.invoke('projects:create', baseTitle, content),
  renameWorkspaceProject: (filePath: string, newTitle: string) =>
    ipcRenderer.invoke('projects:rename', filePath, newTitle),
  duplicateWorkspaceProject: (filePath: string) =>
    ipcRenderer.invoke('projects:duplicate', filePath),
  deleteWorkspaceProject: (filePath: string) => ipcRenderer.invoke('projects:delete', filePath)
})
