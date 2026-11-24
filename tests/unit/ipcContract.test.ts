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
})
