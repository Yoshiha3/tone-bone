import type { PlatformAdapter } from './types'

/**
 * Single source of truth mapping every PlatformAdapter method to its Electron IPC channel.
 * Adding a method to PlatformAdapter requires declaring its channel here at compile time.
 */
export const IPC_CHANNELS = {
  saveProjectFile: 'project:save',
  writeProjectFile: 'project:write',
  openProjectFile: 'project:open',
  saveExportFile: 'audio:saveExport',
  loadSettings: 'settings:load',
  saveSettings: 'settings:save',
  chooseWorkspaceDir: 'workspace:choose',
  openFolder: 'workspace:openFolder',
  listThemePacks: 'packs:listThemes',
  listSoundPacks: 'packs:listSounds',
  listWorkspaceProjects: 'projects:list',
  readWorkspaceProject: 'projects:read',
  createWorkspaceProject: 'projects:create',
  renameWorkspaceProject: 'projects:rename',
  duplicateWorkspaceProject: 'projects:duplicate',
  deleteWorkspaceProject: 'projects:delete'
} as const satisfies Record<keyof PlatformAdapter, string>

export type PlatformMethod = keyof PlatformAdapter
export type IpcChannel = (typeof IPC_CHANNELS)[PlatformMethod]
export type IpcArgs<K extends PlatformMethod> = Parameters<PlatformAdapter[K]>
export type IpcResult<K extends PlatformMethod> = Awaited<ReturnType<PlatformAdapter[K]>>

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
}

/**
 * Registers a type-safe Electron ipcMain handler keyed by PlatformAdapter method name.
 * Both argument types and return type are verified against PlatformAdapter at compile time.
 */
export function registerTypedIpcHandler<K extends PlatformMethod>(
  ipcMain: IpcMainLike,
  method: K,
  handler: (...args: IpcArgs<K>) => IpcResult<K> | Promise<IpcResult<K>>
): void {
  ipcMain.handle(IPC_CHANNELS[method], (_event, ...args) => handler(...(args as IpcArgs<K>)))
}

/**
 * Builds the preload window.tonebone bridge directly from IPC_CHANNELS so adding a new
 * PlatformAdapter method requires zero manual boilerplate in preload.
 */
export function createIpcPlatformBridge(
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
): PlatformAdapter {
  const bridge: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const [method, channel] of Object.entries(IPC_CHANNELS)) {
    bridge[method] = (...args: unknown[]) => invoke(channel, ...args)
  }
  return bridge as unknown as PlatformAdapter
}
