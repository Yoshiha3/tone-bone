import { writeFileSync } from 'fs'
import { join } from 'path'
import { registerTypedIpcHandler } from '@platform/ipcContract'
import { sanitizeDialogFileName, sanitizeExtension } from '../pathSecurity'
import { ensureWorkspaceDirectories } from '../settingsRepository'
import type { ResolvedIpcHandlerDeps } from './index'

export function registerAudioIpc({
  ipcMain,
  dialog,
  settingsRepo
}: ResolvedIpcHandlerDeps): void {
  registerTypedIpcHandler(ipcMain, 'saveExportFile', async (options) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const ext = sanitizeExtension(options.extension)
    const safeSuggestedName = sanitizeDialogFileName(options.suggestedName, `export.${ext}`)
    const result = await dialog.showSaveDialog({
      title: `${ext.toUpperCase()}ファイルを書き出し`,
      defaultPath: join(paths.exports, safeSuggestedName),
      filters: [{ name: options.filterName, extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, Buffer.from(options.data))
    return { canceled: false, filePath: result.filePath }
  })
}
