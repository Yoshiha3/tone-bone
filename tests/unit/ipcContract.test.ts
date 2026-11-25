import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIpcPlatformBridge, IPC_CHANNELS } from '@platform/ipcContract'
import { registerAllIpcHandlers } from '../../src/main/ipc'
import { SettingsRepository } from '../../src/main/settingsRepository'

describe('IPC Contract & Main Handler Registration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const d of tempDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('maps every PlatformAdapter method in createIpcPlatformBridge to its exact IPC channel', async () => {
    const invoked: Array<{ channel: string; args: unknown[] }> = []
    const bridge = createIpcPlatformBridge(async (channel, ...args) => {
      invoked.push({ channel, args })
      return 'ok'
    })

    await bridge.loadSettings()
    await bridge.openFolder('themes')
    await bridge.saveExportFile({
      suggestedName: 'song.mp3',
      filterName: 'MP3 Audio',
      extension: 'mp3',
      data: new Uint8Array([1, 2])
    })

    expect(Object.keys(bridge).sort()).toEqual(Object.keys(IPC_CHANNELS).sort())
    expect(invoked).toEqual([
      { channel: IPC_CHANNELS.loadSettings, args: [] },
      { channel: IPC_CHANNELS.openFolder, args: ['themes'] },
      {
        channel: IPC_CHANNELS.saveExportFile,
        args: [
          {
            suggestedName: 'song.mp3',
            filterName: 'MP3 Audio',
            extension: 'mp3',
            data: new Uint8Array([1, 2])
          }
        ]
      }
    ])
  })

  it('registers all IPC_CHANNELS without omission and forwards dialog filters accurately', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-ipc-test-'))
    tempDirs.push(tempRoot)
    const userDataDir = join(tempRoot, 'userData')
    const workspaceDir = join(tempRoot, 'ToneBone')
    const settingsRepo = new SettingsRepository(userDataDir, workspaceDir)

    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const fakeIpcMain = {
      handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        expect(handlers.has(channel)).toBe(false)
        handlers.set(channel, listener)
      }
    }

    const savedProjectPath = join(workspaceDir, 'projects', 'custom.tb2')
    const savedExportPath = join(workspaceDir, 'exports', 'track.ogg')
    const showSaveDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: false, filePath: savedProjectPath })
      .mockResolvedValueOnce({ canceled: false, filePath: savedExportPath })
    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: false, filePaths: [savedProjectPath] })
    const openPath = vi.fn(async () => '')
    const trashItem = vi.fn(async () => {})

    registerAllIpcHandlers({
      ipcMain: fakeIpcMain,
      dialog: { showOpenDialog, showSaveDialog } as unknown as Parameters<
        typeof registerAllIpcHandlers
      >[0]['dialog'],
      shell: { openPath, trashItem },
      settingsRepo,
      getBuiltinResourcesSubdir: (subdir) => resolve(__dirname, '../../resources', subdir)
    })

    // Every single channel defined in IPC_CHANNELS must be registered
    expect(Array.from(handlers.keys()).sort()).toEqual(Object.values(IPC_CHANNELS).sort())

    // Invoke saveProjectFile with custom codec filter
    const saveProjectHandler = handlers.get(IPC_CHANNELS.saveProjectFile)!
    const saveRes = await saveProjectHandler(null, {
      suggestedName: 'custom.tb2',
      content: 'TB2:{"title":"Custom"}',
      filters: [{ name: 'Tone Bone v2', extensions: ['tb2'] }]
    })
    expect(saveRes).toEqual({ canceled: false, filePath: savedProjectPath })
    expect(showSaveDialog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        filters: [{ name: 'Tone Bone v2', extensions: ['tb2'] }]
      })
    )
    expect(readFileSync(savedProjectPath, 'utf-8')).toBe('TB2:{"title":"Custom"}')

    // Invoke openProjectFile with multi-codec filters
    const openProjectHandler = handlers.get(IPC_CHANNELS.openProjectFile)!
    const openRes = await openProjectHandler(null, {
      filters: [{ name: 'All Supported Projects', extensions: ['json', 'tb2'] }]
    })
    expect(openRes).toEqual({
      canceled: false,
      filePath: savedProjectPath,
      content: 'TB2:{"title":"Custom"}'
    })
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'All Supported Projects', extensions: ['json', 'tb2'] }]
      })
    )

    // Invoke saveExportFile with custom extension
    const saveExportHandler = handlers.get(IPC_CHANNELS.saveExportFile)!
    const exportRes = await saveExportHandler(null, {
      suggestedName: 'track.ogg',
      filterName: 'OGG Audio',
      extension: '.ogg',
      data: new Uint8Array([79, 103, 103, 83])
    })
    expect(exportRes).toEqual({ canceled: false, filePath: savedExportPath })
    expect(showSaveDialog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: 'OGGファイルを書き出し',
        filters: [{ name: 'OGG Audio', extensions: ['ogg'] }]
      })
    )

    // Invoke openFolder
    const openFolderHandler = handlers.get(IPC_CHANNELS.openFolder)!
    await openFolderHandler(null, 'exports')
    expect(openPath).toHaveBeenCalledWith(join(workspaceDir, 'exports'))

    // Smoke-check writeProjectFile
    const writePath = join(workspaceDir, 'projects', 'direct.json')
    writeFileSync(writePath, '{}', 'utf-8')
    const writeRes = await handlers.get(IPC_CHANNELS.writeProjectFile)!(null, writePath, '{"ok":1}')
    expect(writeRes).toEqual({ canceled: false, filePath: writePath })
    expect(readFileSync(writePath, 'utf-8')).toBe('{"ok":1}')
  })

  it('blocks unauthorized path access while permitting dialog-approved external files and workspaces', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-ipc-sec-'))
    tempDirs.push(tempRoot)
    const userDataDir = join(tempRoot, 'userData')
    const workspaceDir = join(tempRoot, 'ToneBone')
    const externalDir = join(tempRoot, 'External')
    const externalProjectPath = join(externalDir, 'outside.json')
    const approvedNewWs = join(tempRoot, 'NewWorkspace')
    const unapprovedWs = join(tempRoot, 'UnapprovedWorkspace')
    const settingsRepo = new SettingsRepository(userDataDir, workspaceDir)

    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const fakeIpcMain = {
      handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener)
      }
    }

    const showSaveDialog = vi.fn().mockResolvedValueOnce({
      canceled: false,
      filePath: externalProjectPath
    })
    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: false, filePaths: [externalProjectPath] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [approvedNewWs] })
    const openPath = vi.fn(async () => '')
    const trashItem = vi.fn(async () => {})

    registerAllIpcHandlers({
      ipcMain: fakeIpcMain,
      dialog: { showOpenDialog, showSaveDialog } as unknown as Parameters<
        typeof registerAllIpcHandlers
      >[0]['dialog'],
      shell: { openPath, trashItem },
      settingsRepo,
      getBuiltinResourcesSubdir: (subdir) => resolve(__dirname, '../../resources', subdir)
    })

    // Arbitrary outside paths must be rejected before dialog approval
    const secretPath = join(tempRoot, 'secret.json')
    writeFileSync(secretPath, '{"secret":true}', 'utf-8')

    expect(() => handlers.get(IPC_CHANNELS.readWorkspaceProject)!(null, secretPath)).toThrow(
      /ワークスペース外/
    )
    expect(() =>
      handlers.get(IPC_CHANNELS.renameWorkspaceProject)!(null, secretPath, 'Hijacked')
    ).toThrow(/ワークスペース外/)
    expect(() => handlers.get(IPC_CHANNELS.duplicateWorkspaceProject)!(null, secretPath)).toThrow(
      /ワークスペース外/
    )
    await expect(
      handlers.get(IPC_CHANNELS.deleteWorkspaceProject)!(null, secretPath)
    ).rejects.toThrow(/ワークスペース外/)
    expect(() =>
      handlers.get(IPC_CHANNELS.writeProjectFile)!(null, secretPath, '{"evil":true}')
    ).toThrow(/許可されていない保存先パス/)

    // Unapproved workspace directory changes and invalid openFolder targets must be rejected
    const currentSettings = settingsRepo.load()
    expect(() =>
      handlers.get(IPC_CHANNELS.saveSettings)!(null, {
        ...currentSettings,
        workspaceDir: unapprovedWs
      })
    ).toThrow(/許可されていないワークスペースパス/)
    await expect(handlers.get(IPC_CHANNELS.openFolder)!(null, '../etc')).rejects.toThrow(
      /不正なフォルダ指定/
    )

    // Dialog-approved external file can be saved and subsequently overwritten via writeProjectFile
    const { mkdirSync } = await import('fs')
    mkdirSync(externalDir, { recursive: true })
    await handlers.get(IPC_CHANNELS.saveProjectFile)!(null, {
      suggestedName: '../../ignored-traversal.json',
      content: '{"v":1}',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: join(workspaceDir, 'projects', 'ignored-traversal.json')
      })
    )
    const overwriteRes = await handlers.get(IPC_CHANNELS.writeProjectFile)!(
      null,
      externalProjectPath,
      '{"v":2}'
    )
    expect(overwriteRes).toEqual({ canceled: false, filePath: externalProjectPath })
    expect(readFileSync(externalProjectPath, 'utf-8')).toBe('{"v":2}')

    // Dialog-approved openProjectFile also grants overwrite permission
    const opened = await handlers.get(IPC_CHANNELS.openProjectFile)!(null, {
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    expect(opened).toEqual({
      canceled: false,
      filePath: externalProjectPath,
      content: '{"v":2}'
    })

    // Dialog-approved chooseWorkspaceDir permits saveSettings with the new workspaceDir
    const chosen = await handlers.get(IPC_CHANNELS.chooseWorkspaceDir)!(null)
    expect(chosen).toBe(approvedNewWs)
    const savedSettings = handlers.get(IPC_CHANNELS.saveSettings)!(null, {
      ...currentSettings,
      workspaceDir: approvedNewWs
    })
    expect(savedSettings).toMatchObject({ workspaceDir: approvedNewWs })
  })
})
