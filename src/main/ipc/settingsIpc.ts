import { registerTypedIpcHandler } from '@platform/ipcContract'
import { isSameResolvedPath, isWorkspaceFolderTarget } from '../pathSecurity'
import { ensureWorkspaceDirectories } from '../settingsRepository'
import type { ResolvedIpcHandlerDeps } from './index'

export function registerSettingsIpc({
  ipcMain,
  dialog,
  shell,
  settingsRepo,
  approvedPaths
}: ResolvedIpcHandlerDeps): void {
  registerTypedIpcHandler(ipcMain, 'loadSettings', () => settingsRepo.load())

  registerTypedIpcHandler(ipcMain, 'saveSettings', (next) => {
    const current = settingsRepo.load()
    const isUnchangedWorkspace = isSameResolvedPath(current.workspaceDir, next.workspaceDir)
    if (!isUnchangedWorkspace && !approvedPaths.isApprovedWorkspaceDir(next.workspaceDir)) {
      throw new Error('許可されていないワークスペースパスです')
    }
    return settingsRepo.save(next)
  })

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
    const chosen = result.filePaths[0]
    approvedPaths.approveWorkspaceDir(chosen)
    return chosen
  })

  registerTypedIpcHandler(ipcMain, 'openFolder', async (target) => {
    if (!isWorkspaceFolderTarget(target)) {
      throw new Error('不正なフォルダ指定です')
    }
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
