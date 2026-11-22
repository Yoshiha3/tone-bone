import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { getGridTickStep } from '@core/musicMath'
import { MemoryPlatformAdapter } from '@platform/MemoryPlatformAdapter'
import { createProjectStore } from '@renderer/store/useProjectStore'
import { loadPacksFromDirectory } from '../../src/main/packRepository'

describe('Store + Codec + Platform + Pack Integration Workflow', () => {
  it('handles full editing, triplet placement, batch move, copy/paste, undo/redo, and save/open round-trip', async () => {
    const builtinPacks = loadPacksFromDirectory(resolve(__dirname, '../../resources/packs'), 'builtin')
    const platform = new MemoryPlatformAdapter(builtinPacks)
    let lastAppliedThemeBg = ''

    const store = createProjectStore({
      platform,
      codecs: createDefaultCodecRegistry(),
      onThemeChanged: (merged) => {
        lastAppliedThemeBg = merged.tokens['--bg-app'] ?? ''
      }
    })

    await store.getState().initialize()
    expect(lastAppliedThemeBg).toBe('#f6f7f9')

    // Switch pack layering to Minimal Dark
    await store.getState().setActivePackIds(['default-minimal', 'minimal-dark'])
    expect(lastAppliedThemeBg).toBe('#16191f')
    expect(store.getState().mergedPacks.instruments.some((i) => i.id === 'glass-bell')).toBe(true)

    // Add a new synth track, rename it, and place two 1/12 triplet notes
    store.getState().addTrack('synth')
    const trackId = store.getState().selectedTrackId
    store.getState().updateTrack(trackId, { name: 'Lead Triplet' })
    expect(store.getState().project.tracks.find((t) => t.id === trackId)?.name).toBe('Lead Triplet')
    const tripletStep = getGridTickStep('1/12') // 160 ticks

    const n1 = store.getState().addNote(trackId, {
      pitch: 60,
      startTick: 0,
      durationTick: tripletStep,
      velocity: 0.8
    })
    expect(store.getState().lastNoteDurationTick).toBe(tripletStep)
    await store.getState().setNoteLengthMode('grid-step')
    expect(store.getState().settings.noteLengthMode).toBe('grid-step')
    const n2 = store.getState().addNote(trackId, {
      pitch: 64,
      startTick: tripletStep,
      durationTick: tripletStep,
      velocity: 0.8
    })

    // Select both notes, move them by +160 ticks and +2 semitones
    store.getState().setSelectedNoteIds([n1.id, n2.id])
    store.getState().moveSelectedNotes(tripletStep, 2)

    const movedTrack = store.getState().project.tracks.find((t) => t.id === trackId)!
    expect(movedTrack.notes.map((n) => [n.pitch, n.startTick])).toEqual([
      [62, 160],
      [66, 320]
    ])

    // Copy and paste at tick 960
    store.getState().copySelectedNotes()
    store.getState().pasteNotes(960)
    const afterPaste = store.getState().project.tracks.find((t) => t.id === trackId)!
    expect(afterPaste.notes).toHaveLength(4)
    expect(afterPaste.notes[2].startTick).toBe(960)
    expect(afterPaste.notes[3].startTick).toBe(1120)

    // Undo paste and redo paste
    store.getState().undo()
    expect(store.getState().project.tracks.find((t) => t.id === trackId)!.notes).toHaveLength(2)
    store.getState().redo()
    expect(store.getState().project.tracks.find((t) => t.id === trackId)!.notes).toHaveLength(4)

    // Modify BPM and Mute/Solo, then save via CodecRegistry -> MemoryPlatform
    store.getState().setBpm(128)
    store.getState().toggleMute(trackId)
    const saved = await store.getState().saveProject()
    expect(saved).toBe(true)
    expect(platform.lastSavedProjectContent).toContain('"bpm": 128')

    // Load saved content into a brand new store and assert exact equality
    const expectedSnapshot = structuredClone(store.getState().project)
    const freshStore = createProjectStore({ platform, codecs: createDefaultCodecRegistry() })
    const opened = await freshStore.getState().openProject()
    expect(opened).toBe(true)
    expect(freshStore.getState().project).toEqual(expectedSnapshot)
  })
})
