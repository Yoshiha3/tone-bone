import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { registerTypedIpcHandler } from '@platform/ipcContract'
import { loadAllSoundPacks, loadAllThemePacks } from './packRepository'
import {
  createUniqueProjectFile,
  deleteWorkspaceProjectFile,
  duplicateWorkspaceProjectFile,
  listWorkspaceProjects,
  readWorkspaceProjectFile,
  renameWorkspaceProjectFile
} from './projectRepository'
import { ensureWorkspaceDirectories, getWorkspacePaths, SettingsRepository } from './settingsRepository'

function getBuiltinResourcesSubdir(subdir: 'themes' | 'sounds'): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, subdir)
  }
  return join(app.getAppPath(), 'resources', subdir)
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
  registerTypedIpcHandler(ipcMain, 'loadSettings', () => settingsRepo.load())

  registerTypedIpcHandler(ipcMain, 'saveSettings', (next) => settingsRepo.save(next))

  registerTypedIpcHandler(ipcMain, 'chooseWorkspaceDir', async () => {
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

  registerTypedIpcHandler(ipcMain, 'openFolder', async (target) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const dir =
      target === 'workspace'
        ? paths.root
        : target === 'projects'
          ? paths.projects
          : target === 'exports'
            ? paths.exports
            : target === 'themes'
              ? paths.themes
              : paths.sounds
    await shell.openPath(dir)
  })

  registerTypedIpcHandler(ipcMain, 'listThemePacks', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return loadAllThemePacks(getBuiltinResourcesSubdir('themes'), paths.themes)
  })

  registerTypedIpcHandler(ipcMain, 'listSoundPacks', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return loadAllSoundPacks(getBuiltinResourcesSubdir('sounds'), paths.sounds)
  })

  registerTypedIpcHandler(ipcMain, 'saveProjectFile', async (options) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const result = await dialog.showSaveDialog({
      title: 'プロジェクトを保存',
      defaultPath: join(paths.projects, options.suggestedName),
      filters: options.filters
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, options.content, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  registerTypedIpcHandler(ipcMain, 'writeProjectFile', (filePath, content) => {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, 'utf-8')
    return { canceled: false, filePath }
  })

  registerTypedIpcHandler(ipcMain, 'openProjectFile', async (options) => {
    const current = settingsRepo.load()
    const paths = getWorkspacePaths(current.workspaceDir)
    const result = await dialog.showOpenDialog({
      title: 'プロジェクトを開く',
      defaultPath: paths.projects,
      filters: options.filters,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    return { canceled: false, filePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'listWorkspaceProjects', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return listWorkspaceProjects(paths.projects)
  })

  registerTypedIpcHandler(ipcMain, 'readWorkspaceProject', (filePath) => {
    const { content } = readWorkspaceProjectFile(filePath)
    return { canceled: false, filePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'createWorkspaceProject', (baseTitle, content) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return createUniqueProjectFile(paths.projects, baseTitle, content)
  })

  registerTypedIpcHandler(ipcMain, 'renameWorkspaceProject', (filePath, newTitle) => {
    return renameWorkspaceProjectFile(filePath, newTitle)
  })

  registerTypedIpcHandler(ipcMain, 'duplicateWorkspaceProject', (filePath) => {
    return duplicateWorkspaceProjectFile(filePath)
  })

  registerTypedIpcHandler(ipcMain, 'deleteWorkspaceProject', async (filePath) => {
    await deleteWorkspaceProjectFile(filePath, (p) => shell.trashItem(p))
  })

  registerTypedIpcHandler(ipcMain, 'saveExportFile', async (options) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const ext = options.extension.replace(/^\./, '')
    const result = await dialog.showSaveDialog({
      title: `${ext.toUpperCase()}ファイルを書き出し`,
      defaultPath: join(paths.exports, options.suggestedName),
      filters: [{ name: options.filterName, extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, Buffer.from(options.data))
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
