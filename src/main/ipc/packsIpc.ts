import { registerTypedIpcHandler } from '@platform/ipcContract'
import { loadAllSoundPacks, loadAllThemePacks } from '../packRepository'
import { ensureWorkspaceDirectories } from '../settingsRepository'
import type { IpcHandlerDeps } from './index'

export function registerPacksIpc({
  ipcMain,
  settingsRepo,
  getBuiltinResourcesSubdir
}: IpcHandlerDeps): void {
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
}
