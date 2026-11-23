import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppSettings } from '@core/types'
import { loadAllResourcePacks } from './packRepository'
import {
  createUniqueProjectFile,
  deleteWorkspaceProjectFile,
  duplicateWorkspaceProjectFile,
  listWorkspaceProjects,
  readWorkspaceProjectFile,
  renameWorkspaceProjectFile
} from './projectRepository'
import { ensureWorkspaceDirectories, getWorkspacePaths, SettingsRepository } from './settingsRepository'

function getBuiltinPacksDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'packs')
  }
  return join(app.getAppPath(), 'resources', 'packs')
}

let mainWindow: BrowserWindow | null = null
let settingsRepo: SettingsRepository

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Tone Bone',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle('settings:load', () => {
    return settingsRepo.load()
  })

  ipcMain.handle('settings:save', (_event, next: AppSettings) => {
    return settingsRepo.save(next)
  })

  ipcMain.handle('workspace:choose', async () => {
    const current = settingsRepo.load()
    const result = await dialog.showOpenDialog({
      title: 'ワークスペースフォルダを選択',
      defaultPath: current.workspaceDir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(
    'workspace:openFolder',
    async (_event, target: 'workspace' | 'projects' | 'exports' | 'packs') => {
      const current = settingsRepo.load()
      const paths = ensureWorkspaceDirectories(current.workspaceDir)
      const dir =
        target === 'workspace'
          ? paths.root
          : target === 'projects'
            ? paths.projects
            : target === 'exports'
              ? paths.exports
              : paths.packs
      await shell.openPath(dir)
    }
  )

  ipcMain.handle('packs:list', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return loadAllResourcePacks(getBuiltinPacksDir(), paths.packs)
  })

  ipcMain.handle('project:save', async (_event, suggestedName: string, content: string) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const result = await dialog.showSaveDialog({
      title: 'プロジェクトを保存',
      defaultPath: join(paths.projects, suggestedName),
      filters: [{ name: 'Tone Bone Project', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, content, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('project:write', (_event, filePath: string, content: string) => {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, 'utf-8')
    return { canceled: false, filePath }
  })

  ipcMain.handle('project:open', async () => {
    const current = settingsRepo.load()
    const paths = getWorkspacePaths(current.workspaceDir)
    const result = await dialog.showOpenDialog({
      title: 'プロジェクトを開く',
      defaultPath: paths.projects,
      filters: [{ name: 'Tone Bone Project', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    return { canceled: false, filePath, content }
  })

  ipcMain.handle('projects:list', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return listWorkspaceProjects(paths.projects)
  })

  ipcMain.handle('projects:read', (_event, filePath: string) => {
    const { content } = readWorkspaceProjectFile(filePath)
    return { canceled: false, filePath, content }
  })

  ipcMain.handle('projects:create', (_event, baseTitle: string, content: string) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return createUniqueProjectFile(paths.projects, baseTitle, content)
  })

  ipcMain.handle('projects:rename', (_event, filePath: string, newTitle: string) => {
    return renameWorkspaceProjectFile(filePath, newTitle)
  })

  ipcMain.handle('projects:duplicate', (_event, filePath: string) => {
    return duplicateWorkspaceProjectFile(filePath)
  })

  ipcMain.handle('projects:delete', async (_event, filePath: string) => {
    await deleteWorkspaceProjectFile(filePath, (p) => shell.trashItem(p))
  })

  ipcMain.handle('audio:saveWav', async (_event, suggestedName: string, bytes: Uint8Array) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const result = await dialog.showSaveDialog({
      title: 'WAVファイルを書き出し',
      defaultPath: join(paths.exports, suggestedName),
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, Buffer.from(bytes))
    return { canceled: false, filePath: result.filePath }
  })
}

void app.whenReady().then(() => {
  const defaultWorkspace = join(app.getPath('documents'), 'ToneBone')
  settingsRepo = new SettingsRepository(app.getPath('userData'), defaultWorkspace)
  settingsRepo.load()

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
