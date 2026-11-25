import { PPQN } from '@core/types'
import type { LeaveDecision } from '@persistence/types'
import { clampPxPerBeat, DEFAULT_PX_PER_BEAT } from '../../components/pianoRoll/pianoRollGeometry'
import type { StoreGet, StoreSet, UiSlice } from '../types'

export function createUiSlice(
  set: StoreSet,
  get: StoreGet,
  initialSelectedTrackId: string
): UiSlice {
  return {
    selectedTrackId: initialSelectedTrackId,
    selectedNoteIds: [],
    clipboardNotes: [],
    gridDivision: '1/16',
    pxPerBeat: DEFAULT_PX_PER_BEAT,
    pianoRollToolMode: 'draw',
    pianoRollScroll: { left: 0, top: null },
    lastNoteDurationTick: PPQN / 2,
    viewMode: 'home',
    settingsOpen: false,
    isPlaying: false,
    statusMessage: null,
    selectedHomeProjectPath: null,
    unsavedPrompt: null,

    setSelectedHomeProjectPath: (selectedHomeProjectPath) => set({ selectedHomeProjectPath }),

    requestLeaveDecision(prompt) {
      const existing = get().unsavedPrompt
      if (existing) {
        existing.resolve('cancel')
      }
      return new Promise<LeaveDecision>((resolve) => {
        set({ unsavedPrompt: { ...prompt, resolve } })
      })
    },

    resolveLeaveDecision(decision) {
      const current = get().unsavedPrompt
      if (!current) return
      set({ unsavedPrompt: null })
      current.resolve(decision)
    },

    setViewMode: (viewMode) => set({ viewMode }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setGridDivision: (gridDivision) => set({ gridDivision }),
    setPxPerBeat: (pxPerBeat) => set({ pxPerBeat: clampPxPerBeat(pxPerBeat) }),
    setPianoRollToolMode: (pianoRollToolMode) => set({ pianoRollToolMode }),
    setPianoRollScroll: (pianoRollScroll) => set({ pianoRollScroll }),
    setLastNoteDurationTick: (ticks) =>
      set({ lastNoteDurationTick: Math.max(30, Math.round(ticks)) }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setSelectedTrackId: (selectedTrackId) =>
      set((s) =>
        s.selectedTrackId === selectedTrackId
          ? { selectedTrackId, selectedNoteIds: [] }
          : {
              selectedTrackId,
              selectedNoteIds: [],
              pianoRollScroll: { left: s.pianoRollScroll.left, top: null }
            }
      ),
    setSelectedNoteIds: (selectedNoteIds) => set({ selectedNoteIds }),
    selectAllNotes: () => {
      const { project, selectedTrackId } = get()
      const track = project.tracks.find((t) => t.id === selectedTrackId)
      if (!track) return
      set({ selectedNoteIds: track.notes.map((n) => n.id) })
    },
    clearStatusMessage: () => set({ statusMessage: null })
  }
}
