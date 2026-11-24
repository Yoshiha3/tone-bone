import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exportCurrentProject,
  requestNewProject,
  requestOpenExternalProject,
  requestReturnToHome,
  sanitizeFileName,
  stopPlayback,
  togglePlayPause
} from '@renderer/actions'
import { audioEngine, audioExporterRegistry } from '@renderer/audioContext'
import { defaultPlatform, projectStore } from '@renderer/store/useProjectStore'

describe('actions', () => {
  beforeEach(() => {
    projectStore.setState({
      viewMode: 'edit',
      isPlaying: false,
      isDirty: false,
      currentFilePath: null,
      unsavedPrompt: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sanitizes file names by replacing forbidden OS characters and falling back to untitled', () => {
    expect(sanitizeFileName('  My / Song: "01"?  ')).toBe('My _ Song_ _01__')
    expect(sanitizeFileName('   ')).toBe('untitled')
    expect(sanitizeFileName('a<b>c|d*e\\f')).toBe('a_b_c_d_e_f')
  })

  it('toggles play/pause and stops playback in sync with projectStore', () => {
    const isPlayingSpy = vi.spyOn(audioEngine, 'getIsPlaying')
    const playSpy = vi.spyOn(audioEngine, 'play').mockImplementation(() => {})
    const pauseSpy = vi.spyOn(audioEngine, 'pause').mockImplementation(() => {})
    const stopSpy = vi.spyOn(audioEngine, 'stop').mockImplementation(() => {})

    isPlayingSpy.mockReturnValue(false)
    togglePlayPause()
    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(projectStore.getState().isPlaying).toBe(true)

    isPlayingSpy.mockReturnValue(true)
    togglePlayPause()
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(projectStore.getState().isPlaying).toBe(false)

    projectStore.getState().setIsPlaying(true)
    stopPlayback()
    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(projectStore.getState().isPlaying).toBe(false)
  })

  it('stops playback and delegates requestReturnToHome to store.returnToHome', async () => {
    const stopSpy = vi.spyOn(audioEngine, 'stop').mockImplementation(() => {})
    const returnSpy = vi.spyOn(projectStore.getState(), 'returnToHome').mockResolvedValue(true)

    const result = await requestReturnToHome()
    expect(result).toBe(true)
    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(returnSpy).toHaveBeenCalledTimes(1)
  })

  it('guards requestNewProject and requestOpenExternalProject when leaving edit view is canceled', async () => {
    const stopSpy = vi.spyOn(audioEngine, 'stop').mockImplementation(() => {})
    const prepareSpy = vi
      .spyOn(projectStore.getState(), 'prepareLeaveCurrentProject')
      .mockResolvedValue(false)
    const createSpy = vi.spyOn(projectStore.getState(), 'createWorkspaceProject')
    const openSpy = vi.spyOn(projectStore.getState(), 'openProject')

    expect(await requestNewProject()).toBe(false)
    expect(await requestOpenExternalProject()).toBe(false)
    expect(prepareSpy).toHaveBeenCalledTimes(2)
    expect(stopSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('creates or opens project when leaving is allowed (or already on home screen)', async () => {
    const stopSpy = vi.spyOn(audioEngine, 'stop').mockImplementation(() => {})
    const createSpy = vi
      .spyOn(projectStore.getState(), 'createWorkspaceProject')
      .mockResolvedValue({
        filePath: '/a.json',
        fileName: 'a.json',
        title: 'Untitled',
        bpm: 120,
        bars: 4,
        trackCount: 2,
        updatedAtMs: 1
      })
    const openSpy = vi.spyOn(projectStore.getState(), 'openProject').mockResolvedValue(true)

    projectStore.getState().setViewMode('home')
    expect(await requestNewProject()).toBe(true)
    expect(createSpy).toHaveBeenCalledWith('empty', { openImmediately: true })
    expect(await requestOpenExternalProject()).toBe(true)
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(stopSpy).toHaveBeenCalledTimes(2)
  })

  it('exports audio bytes via AudioExporterRegistry and saves with sanitized filename', async () => {
    const fakeBytes = new Uint8Array([82, 73, 70, 70])
    const defaultExporter = audioExporterRegistry.getDefault()
    const exportSpy = vi.spyOn(defaultExporter, 'export').mockResolvedValue(fakeBytes)
    const saveExportSpy = vi
      .spyOn(defaultPlatform, 'saveExportFile')
      .mockResolvedValue({ canceled: false, filePath: '/exports/Demo_Mix.wav' })

    projectStore.setState((s) => ({
      project: { ...s.project, title: 'Demo:Mix' }
    }))

    expect(await exportCurrentProject()).toBe(true)
    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(saveExportSpy).toHaveBeenCalledWith({
      suggestedName: 'Demo_Mix.wav',
      filterName: 'WAV Audio',
      extension: 'wav',
      data: fakeBytes
    })

    saveExportSpy.mockResolvedValueOnce({ canceled: true })
    expect(await exportCurrentProject()).toBe(false)
  })

  it('exports using a custom registered exporter id without modifying actions or platform', async () => {
    const fakeMidi = new Uint8Array([77, 84, 104, 100])
    const midiExporter = {
      id: 'test-midi',
      label: 'Standard MIDI',
      extension: 'mid',
      export: vi.fn(async () => fakeMidi)
    }
    audioExporterRegistry.register(midiExporter)

    const saveExportSpy = vi
      .spyOn(defaultPlatform, 'saveExportFile')
      .mockResolvedValue({ canceled: false, filePath: '/exports/Demo_Mix.mid' })

    projectStore.setState((s) => ({
      project: { ...s.project, title: 'Demo:Mix' }
    }))

    expect(await exportCurrentProject('test-midi')).toBe(true)
    expect(midiExporter.export).toHaveBeenCalledTimes(1)
    expect(saveExportSpy).toHaveBeenCalledWith({
      suggestedName: 'Demo_Mix.mid',
      filterName: 'Standard MIDI',
      extension: 'mid',
      data: fakeMidi
    })
  })
})
