import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElectronPlatformAdapter } from '@platform/ElectronPlatformAdapter'
import type { PlatformAdapter } from '@platform/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ElectronPlatformAdapter', () => {
  it('throws a clear error when window.tonebone preload bridge is unavailable', () => {
    vi.stubGlobal('window', {})
    const adapter = new ElectronPlatformAdapter()
    expect(() => adapter.loadSettings()).toThrow('window.tonebone')
  })

  it('delegates all 16 PlatformAdapter methods to window.tonebone', async () => {
    const bridge: PlatformAdapter = {
      saveProjectFile: vi.fn(async () => ({ canceled: false, filePath: '/p.json' })),
      writeProjectFile: vi.fn(async () => ({ canceled: false, filePath: '/p.json' })),
      openProjectFile: vi.fn(async () => ({ canceled: false, filePath: '/p.json', content: '{}' })),
      saveWavFile: vi.fn(async () => ({ canceled: false, filePath: '/a.wav' })),
      loadSettings: vi.fn(async () => ({
        workspaceDir: '/ws',
        activeThemePackIds: ['minimal-light'],
        activeSoundPackIds: ['default-sounds'],
        noteLengthMode: 'last-used' as const,
        saveMode: 'auto' as const
      })),
      saveSettings: vi.fn(async (s) => s),
      chooseWorkspaceDir: vi.fn(async () => '/new-ws'),
      openFolder: vi.fn(async () => {}),
      listThemePacks: vi.fn(async () => []),
      listSoundPacks: vi.fn(async () => []),
      listWorkspaceProjects: vi.fn(async () => []),
      readWorkspaceProject: vi.fn(async () => ({ canceled: false, content: '{}' })),
      createWorkspaceProject: vi.fn(async () => ({
        filePath: '/p.json',
        fileName: 'p.json',
        title: 'p',
        bpm: 120,
        bars: 4,
        trackCount: 2,
        updatedAtMs: 1
      })),
      renameWorkspaceProject: vi.fn(async () => ({
        filePath: '/q.json',
        fileName: 'q.json',
        title: 'q',
        bpm: 120,
        bars: 4,
        trackCount: 2,
        updatedAtMs: 2
      })),
      duplicateWorkspaceProject: vi.fn(async () => ({
        filePath: '/p2.json',
        fileName: 'p2.json',
        title: 'p Copy',
        bpm: 120,
        bars: 4,
        trackCount: 2,
        updatedAtMs: 3
      })),
      deleteWorkspaceProject: vi.fn(async () => {})
    }

    vi.stubGlobal('window', { tonebone: bridge })
    const adapter = new ElectronPlatformAdapter()

    await adapter.saveProjectFile('a.json', '{}')
    await adapter.writeProjectFile('/a.json', '{}')
    await adapter.openProjectFile()
    await adapter.saveWavFile('a.wav', new Uint8Array([1]))
    const loaded = await adapter.loadSettings()
    await adapter.saveSettings(loaded)
    await adapter.chooseWorkspaceDir()
    await adapter.openFolder('projects')
    await adapter.listThemePacks()
    await adapter.listSoundPacks()
    await adapter.listWorkspaceProjects()
    await adapter.readWorkspaceProject('/p.json')
    await adapter.createWorkspaceProject('p', '{}')
    await adapter.renameWorkspaceProject('/p.json', 'q')
    await adapter.duplicateWorkspaceProject('/p.json')
    await adapter.deleteWorkspaceProject('/p.json')

    for (const fn of Object.values(bridge)) {
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })
})
