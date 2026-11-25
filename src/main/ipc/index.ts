import type { dialog, shell } from 'electron'
import { createDefaultCodecRegistry, type CodecRegistry } from '@codecs/CodecRegistry'
import type { IpcMainLike } from '@platform/ipcContract'
import { ApprovedPathStore } from '../pathSecurity'
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
  approvedPaths?: ApprovedPathStore
  codecs?: CodecRegistry
}

export interface ResolvedIpcHandlerDeps extends IpcHandlerDeps {
  approvedPaths: ApprovedPathStore
  codecs: CodecRegistry
}

export function registerAllIpcHandlers(deps: IpcHandlerDeps): void {
  const resolvedDeps: ResolvedIpcHandlerDeps = {
    ...deps,
    approvedPaths: deps.approvedPaths ?? new ApprovedPathStore(),
    codecs: deps.codecs ?? createDefaultCodecRegistry()
  }
  registerSettingsIpc(resolvedDeps)
  registerPacksIpc(resolvedDeps)
  registerProjectIpc(resolvedDeps)
  registerAudioIpc(resolvedDeps)
}
