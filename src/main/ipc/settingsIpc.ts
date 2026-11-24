import { registerTypedIpcHandler } from '@platform/ipcContract'
import { ensureWorkspaceDirectories } from '../settingsRepository'
import type { IpcHandlerDeps } from './index'

export function registerSettingsIpc({ ipcMain, dialog, shell, settingsRepo }: IpcHandlerDeps): void {
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
}
