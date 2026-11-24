import { PPQN } from '@core/types'
import type { LeaveDecision } from '@persistence/types'
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
    setLastNoteDurationTick: (ticks) =>
      set({ lastNoteDurationTick: Math.max(30, Math.round(ticks)) }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId, selectedNoteIds: [] }),
    setSelectedNoteIds: (selectedNoteIds) => set({ selectedNoteIds }),
    clearStatusMessage: () => set({ statusMessage: null })
  }
}
