import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { registerTypedIpcHandler } from '@platform/ipcContract'
import {
  assertWorkspaceProjectFilePath,
  hasAllowedExtension,
  isPathInsideDirectory,
  sanitizeDialogFileName
} from '../pathSecurity'
import {
  createUniqueProjectFile,
  deleteWorkspaceProjectFile,
  duplicateWorkspaceProjectFile,
  listWorkspaceProjects,
  readWorkspaceProjectFile,
  renameWorkspaceProjectFile
} from '../projectRepository'
import { ensureWorkspaceDirectories, getWorkspacePaths } from '../settingsRepository'
import type { ResolvedIpcHandlerDeps } from './index'

export function registerProjectIpc({
  ipcMain,
  dialog,
  shell,
  settingsRepo,
  approvedPaths,
  codecs
}: ResolvedIpcHandlerDeps): void {
  const getProjectsDir = (): string => {
    const current = settingsRepo.load()
    return ensureWorkspaceDirectories(current.workspaceDir).projects
  }

  registerTypedIpcHandler(ipcMain, 'saveProjectFile', async (options) => {
    const projectsDir = getProjectsDir()
    const safeSuggestedName = sanitizeDialogFileName(
      options.suggestedName,
      `untitled.${codecs.getDefaultExtension()}`
    )
    const result = await dialog.showSaveDialog({
      title: 'プロジェクトを保存',
      defaultPath: join(projectsDir, safeSuggestedName),
      filters: options.filters
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, options.content, 'utf-8')
    approvedPaths.approveProjectFile(result.filePath)
    return { canceled: false, filePath: result.filePath }
  })

  registerTypedIpcHandler(ipcMain, 'writeProjectFile', (filePath, content) => {
    const projectsDir = getProjectsDir()
    const allowedExts = codecs.getAllExtensions()
    const isWorkspaceTarget =
      isPathInsideDirectory(projectsDir, filePath) &&
      hasAllowedExtension(filePath, allowedExts) &&
      !(existsSync(filePath) && lstatSync(filePath).isSymbolicLink())

    if (!isWorkspaceTarget && !approvedPaths.isApprovedProjectFile(filePath)) {
      throw new Error('許可されていない保存先パスです')
    }

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
    approvedPaths.approveProjectFile(filePath)
    return { canceled: false, filePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'listWorkspaceProjects', () => {
    return listWorkspaceProjects(getProjectsDir(), codecs)
  })

  registerTypedIpcHandler(ipcMain, 'readWorkspaceProject', (filePath) => {
    const safePath = assertWorkspaceProjectFilePath(
      getProjectsDir(),
      filePath,
      codecs.getAllExtensions()
    )
    const { content } = readWorkspaceProjectFile(safePath)
    return { canceled: false, filePath: safePath, content }
  })

  registerTypedIpcHandler(ipcMain, 'createWorkspaceProject', (baseTitle, content) => {
    return createUniqueProjectFile(getProjectsDir(), baseTitle, content, codecs)
  })

  registerTypedIpcHandler(ipcMain, 'renameWorkspaceProject', (filePath, newTitle) => {
    const safePath = assertWorkspaceProjectFilePath(
      getProjectsDir(),
      filePath,
      codecs.getAllExtensions()
    )
    return renameWorkspaceProjectFile(safePath, newTitle, codecs)
  })

  registerTypedIpcHandler(ipcMain, 'duplicateWorkspaceProject', (filePath) => {
    const safePath = assertWorkspaceProjectFilePath(
      getProjectsDir(),
      filePath,
      codecs.getAllExtensions()
    )
    return duplicateWorkspaceProjectFile(safePath, codecs)
  })

  registerTypedIpcHandler(ipcMain, 'deleteWorkspaceProject', async (filePath) => {
    const safePath = assertWorkspaceProjectFilePath(
      getProjectsDir(),
      filePath,
      codecs.getAllExtensions()
    )
    await deleteWorkspaceProjectFile(safePath, (p) => shell.trashItem(p))
  })
}
