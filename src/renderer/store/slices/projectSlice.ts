import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory
} from '@core/history'
import { clamp, cloneNotesForPaste, getNotesEndTick, moveNotes } from '@core/musicMath'
import { getTrackTypeSpec } from '@core/trackTypes'
import { MAX_BARS, TICKS_PER_BAR, type Note, type Project, type Track } from '@core/types'
import { createId } from '../helpers'
import type { ProjectSlice, SliceRuntime, StoreGet, StoreSet } from '../types'

export function createProjectSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: SliceRuntime,
  initialProject: Project
): ProjectSlice {
  const { commit, notifyProjectChanged } = runtime

  return {
    history: createHistory(initialProject),
    project: initialProject,

    setTitle: (title) => {
      const trimmed = title.trim()
      if (!trimmed || trimmed === get().project.title) return
      commit((p) => ({ ...p, title: trimmed }))
    },
    setBpm: (bpm) => commit((p) => ({ ...p, bpm: clamp(Math.round(bpm), 40, 300) })),
    setBars: (bars) => commit((p) => ({ ...p, bars: clamp(Math.round(bars), 1, MAX_BARS) })),
    toggleLoop: () => commit((p) => ({ ...p, loopEnabled: !p.loopEnabled })),

    addTrack: (type) => {
      const { project, mergedSounds } = get()
      const spec = getTrackTypeSpec(type)
      const matchingInst = mergedSounds.instruments.find((i) => i.type === type)
      const newTrack: Track = {
        id: createId('track'),
        name: `${spec.defaultNamePrefix} ${project.tracks.length + 1}`,
        type,
        instrumentId: matchingInst?.id ?? spec.defaultInstrumentId,
        colorIndex: project.tracks.length % 6,
        volume: 0.78,
        muted: false,
        solo: false,
        notes: []
      }
      commit((p) => ({ ...p, tracks: [...p.tracks, newTrack] }))
      set({ selectedTrackId: newTrack.id, selectedNoteIds: [] })
    },

    removeTrack: (trackId) => {
      const { project, selectedTrackId } = get()
      if (project.tracks.length <= 1) return
      const remaining = project.tracks.filter((t) => t.id !== trackId)
      commit((p) => ({ ...p, tracks: remaining }))
      if (selectedTrackId === trackId) {
        set({ selectedTrackId: remaining[0]?.id ?? '', selectedNoteIds: [] })
      }
    },

    reorderTracks: (fromIndex, toIndex) => {
      const { tracks } = get().project
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= tracks.length ||
        toIndex >= tracks.length
      ) {
        return
      }
      commit((p) => {
        const nextTracks = [...p.tracks]
        const [moved] = nextTracks.splice(fromIndex, 1)
        if (!moved) return p
        nextTracks.splice(toIndex, 0, moved)
        return { ...p, tracks: nextTracks }
      })
    },

    updateTrack: (trackId, patch) => {
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t))
      }))
    },

    toggleMute: (trackId) => {
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
      }))
    },

    toggleSolo: (trackId) => {
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t))
      }))
    },

    addNote: (trackId, noteInput) => {
      const note: Note = { ...noteInput, id: createId('note') }
      const track = get().project.tracks.find((t) => t.id === trackId)
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, notes: [...t.notes, note] } : t))
      }))
      if (track && getTrackTypeSpec(track.type).remembersLastNoteDuration) {
        set({ lastNoteDurationTick: Math.max(30, Math.round(note.durationTick)) })
      }
      return note
    },

    updateNote: (trackId, noteId, patch) => {
      const track = get().project.tracks.find((t) => t.id === trackId)
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.id === trackId
            ? { ...t, notes: t.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)) }
            : t
        )
      }))
      if (
        track &&
        getTrackTypeSpec(track.type).remembersLastNoteDuration &&
        typeof patch.durationTick === 'number'
      ) {
        set({ lastNoteDurationTick: Math.max(30, Math.round(patch.durationTick)) })
      }
    },

    deleteNote: (trackId, noteId) => {
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.id === trackId ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) } : t
        )
      }))
      set((s) => ({ selectedNoteIds: s.selectedNoteIds.filter((id) => id !== noteId) }))
    },

    deleteSelectedNotes: () => {
      const { selectedTrackId, selectedNoteIds } = get()
      if (selectedNoteIds.length === 0) return
      const idSet = new Set(selectedNoteIds)
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.id === selectedTrackId ? { ...t, notes: t.notes.filter((n) => !idSet.has(n.id)) } : t
        )
      }))
      set({ selectedNoteIds: [] })
    },

    moveSelectedNotes: (deltaTick, deltaPitch) => {
      const { project, selectedTrackId, selectedNoteIds } = get()
      if (selectedNoteIds.length === 0 || (deltaTick === 0 && deltaPitch === 0)) return null
      const track = project.tracks.find((t) => t.id === selectedTrackId)
      if (!track) return null
      const spec = getTrackTypeSpec(track.type)
      const minPitch = spec.minPitch
      const maxPitch = spec.maxPitch
      const maxTicks = project.bars * TICKS_PER_BAR
      const idSet = new Set(selectedNoteIds)

      const nextNotes = moveNotes(
        track.notes,
        idSet,
        deltaTick,
        deltaPitch,
        minPitch,
        maxPitch,
        maxTicks
      )
      const changed = nextNotes.some(
        (n, idx) =>
          n.startTick !== track.notes[idx]?.startTick || n.pitch !== track.notes[idx]?.pitch
      )
      if (!changed) return null

      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === selectedTrackId ? { ...t, notes: nextNotes } : t))
      }))

      const anchorId = selectedNoteIds[0]
      return (
        nextNotes.find((n) => n.id === anchorId) ?? nextNotes.find((n) => idSet.has(n.id)) ?? null
      )
    },

    copySelectedNotes: () => {
      const { project, selectedTrackId, selectedNoteIds } = get()
      if (selectedNoteIds.length === 0) return
      const track = project.tracks.find((t) => t.id === selectedTrackId)
      if (!track) return
      const idSet = new Set(selectedNoteIds)
      const copied = track.notes.filter((n) => idSet.has(n.id)).map((n) => ({ ...n }))
      set({ clipboardNotes: copied, statusMessage: `${copied.length}個のノーツをコピーしました` })
    },

    pasteNotes: (targetTick) => {
      const { project, selectedTrackId, clipboardNotes } = get()
      if (clipboardNotes.length === 0) return null
      const maxTicks = project.bars * TICKS_PER_BAR
      const pasted = cloneNotesForPaste(clipboardNotes, targetTick, maxTicks, () =>
        createId('note')
      )
      const rawEndTick = getNotesEndTick(pasted)
      if (pasted.length === 0 || rawEndTick === null) return null
      commit((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.id === selectedTrackId ? { ...t, notes: [...t.notes, ...pasted] } : t
        )
      }))
      set({
        selectedNoteIds: pasted.map((n) => n.id),
        statusMessage: `${pasted.length}個のノーツをペーストしました`
      })
      return Math.min(maxTicks, rawEndTick)
    },

    commitProjectSnapshot: (nextProject) => {
      const state = get()
      const nextHistory = pushHistory(state.history, nextProject)
      set({ history: nextHistory, project: nextProject, isDirty: true })
      notifyProjectChanged()
    },

    undo: () => {
      const { history } = get()
      if (!canUndo(history)) return
      const prev = undoHistory(history)
      set({ history: prev, project: prev.present, selectedNoteIds: [], isDirty: true })
      notifyProjectChanged()
    },

    redo: () => {
      const { history } = get()
      if (!canRedo(history)) return
      const next = redoHistory(history)
      set({ history: next, project: next.present, selectedNoteIds: [], isDirty: true })
      notifyProjectChanged()
    },

    canUndo: () => canUndo(get().history),
    canRedo: () => canRedo(get().history)
  }
}
