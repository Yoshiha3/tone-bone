import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { registerTypedIpcHandler } from '@platform/ipcContract'
import {
  createUniqueProjectFile,
  deleteWorkspaceProjectFile,
  duplicateWorkspaceProjectFile,
  listWorkspaceProjects,
  readWorkspaceProjectFile,
  renameWorkspaceProjectFile
} from '../projectRepository'
import { ensureWorkspaceDirectories, getWorkspacePaths } from '../settingsRepository'
import type { IpcHandlerDeps } from './index'

export function registerProjectIpc({ ipcMain, dialog, shell, settingsRepo }: IpcHandlerDeps): void {
  registerTypedIpcHandler(ipcMain, 'saveProjectFile', async (options) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    const result = await dialog.showSaveDialog({
      title: 'プロジェクトを保存',
      defaultPath: join(paths.projects, options.suggestedName),
      filters: options.filters
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, options.content, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  registerTypedIpcHandler(ipcMain, 'writeProjectFile', (filePath, content) => {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, 'utf-8')
    return { canceled: false, filePath }
  })

  registerTypedIpcHandler(ipcMain, 'openProjectFile', async (options) => {
    const current = settingsRepo.load()
    const paths = getWorkspacePaths(current.workspaceDir)
    const result = await dialog.showOpenDialog({
      title: 'プロジェクトを開く',
      defaultPath: paths.projects,
      filters: options.filters,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    return { canceled: false, filePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'listWorkspaceProjects', () => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return listWorkspaceProjects(paths.projects)
  })

  registerTypedIpcHandler(ipcMain, 'readWorkspaceProject', (filePath) => {
    const { content } = readWorkspaceProjectFile(filePath)
    return { canceled: false, filePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'createWorkspaceProject', (baseTitle, content) => {
    const current = settingsRepo.load()
    const paths = ensureWorkspaceDirectories(current.workspaceDir)
    return createUniqueProjectFile(paths.projects, baseTitle, content)
  })

  registerTypedIpcHandler(ipcMain, 'renameWorkspaceProject', (filePath, newTitle) => {
    return renameWorkspaceProjectFile(filePath, newTitle)
  })

  registerTypedIpcHandler(ipcMain, 'duplicateWorkspaceProject', (filePath) => {
    return duplicateWorkspaceProjectFile(filePath)
  })

  registerTypedIpcHandler(ipcMain, 'deleteWorkspaceProject', async (filePath) => {
    await deleteWorkspaceProjectFile(filePath, (p) => shell.trashItem(p))
  })
}
