import { writeFileSync } from 'fs'
import { join } from 'path'
import { registerTypedIpcHandler } from '@platform/ipcContract'
import { ensureWorkspaceDirectories } from '../settingsRepository'
import type { IpcHandlerDeps } from './index'

export function registerAudioIpc({ ipcMain, dialog, settingsRepo }: IpcHandlerDeps): void {
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
