import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { join } from 'path'
import { registerAllIpcHandlers } from './ipc'
import {
  applySessionSecurity,
  applyWindowSecurity,
  assertTrustedIpcEvent,
  createGuardedIpcMain
} from './security'
import { SettingsRepository } from './settingsRepository'

function getBuiltinResourcesSubdir(subdir: 'themes' | 'sounds'): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, subdir)
  }
  return join(app.getAppPath(), 'resources', subdir)
}

const rendererHtmlPath = join(__dirname, '../renderer/index.html')
const devServerUrl = process.env.ELECTRON_RENDERER_URL

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
      sandbox: true
    }
  })

  applyWindowSecurity(mainWindow, { rendererHtmlPath, devServerUrl })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(rendererHtmlPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

void app.whenReady().then(() => {
  applySessionSecurity(session.defaultSession)

  const defaultWorkspace = join(app.getPath('documents'), 'ToneBone')
  const settingsRepo = new SettingsRepository(app.getPath('userData'), defaultWorkspace)
  settingsRepo.load()

  const guardedIpcMain = createGuardedIpcMain(ipcMain, (event) =>
    assertTrustedIpcEvent(event, rendererHtmlPath, devServerUrl)
  )

  registerAllIpcHandlers({
    ipcMain: guardedIpcMain,
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
