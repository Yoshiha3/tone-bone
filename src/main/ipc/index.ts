import type { dialog, shell } from 'electron'
import type { IpcMainLike } from '@platform/ipcContract'
import type { SettingsRepository } from '../settingsRepository'
import { registerAudioIpc } from './audioIpc'
import { registerPacksIpc } from './packsIpc'
import { registerProjectIpc } from './projectIpc'
import { registerSettingsIpc } from './settingsIpc'

export interface IpcHandlerDeps {
  ipcMain: IpcMainLike
  dialog: Pick<typeof dialog, 'showOpenDialog' | 'showSaveDialog'>
  shell: Pick<typeof shell, 'openPath' | 'trashItem'>
  settingsRepo: SettingsRepository
  getBuiltinResourcesSubdir: (subdir: 'themes' | 'sounds') => string
}

export function registerAllIpcHandlers(deps: IpcHandlerDeps): void {
  registerSettingsIpc(deps)
  registerPacksIpc(deps)
  registerProjectIpc(deps)
  registerAudioIpc(deps)
}
