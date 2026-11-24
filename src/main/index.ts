import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { registerAllIpcHandlers } from './ipc'
import { SettingsRepository } from './settingsRepository'

function getBuiltinResourcesSubdir(subdir: 'themes' | 'sounds'): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, subdir)
  }
  return join(app.getAppPath(), 'resources', subdir)
}

let mainWindow: BrowserWindow | null = null

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

void app.whenReady().then(() => {
  const defaultWorkspace = join(app.getPath('documents'), 'ToneBone')
  const settingsRepo = new SettingsRepository(app.getPath('userData'), defaultWorkspace)
  settingsRepo.load()

  registerAllIpcHandlers({
    ipcMain,
    dialog,
    shell,
    settingsRepo,
    getBuiltinResourcesSubdir
  })
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
