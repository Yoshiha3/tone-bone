import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { createDefaultCodecRegistry, type CodecRegistry } from '@codecs/CodecRegistry'
import { createDemoProject } from '@core/demoProject'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryStack
} from '@core/history'
import { clamp, cloneNotesForPaste, moveNotes } from '@core/musicMath'
import {
  DRUM_LANES,
  PPQN,
  TICKS_PER_BAR,
  type AppSettings,
  type GridDivision,
  type MergedPackConfig,
  type Note,
  type NoteLengthMode,
  type Project,
  type ResourcePack,
  type Track,
  type TrackType
} from '@core/types'
import { FALLBACK_VISUALIZER_PRESET, mergeResourcePacks } from '@packs/packMerger'
import { ElectronPlatformAdapter } from '@platform/ElectronPlatformAdapter'
import type { PlatformAdapter } from '@platform/types'

let idCounter = 1
function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${idCounter++}`
}

export type ViewMode = 'edit' | 'stage'

export interface ProjectStoreState {
  history: HistoryStack<Project>
  project: Project
  selectedTrackId: string
  selectedNoteIds: string[]
  clipboardNotes: Note[]
  gridDivision: GridDivision
  lastNoteDurationTick: number
  viewMode: ViewMode
  settingsOpen: boolean
  isPlaying: boolean
  statusMessage: string | null

  settings: AppSettings
  availablePacks: ResourcePack[]
  mergedPacks: MergedPackConfig

  // Lifecycle & Platform
  initialize(): Promise<void>
  reloadPacks(): Promise<void>
  setActivePackIds(packIds: string[]): Promise<void>
  setNoteLengthMode(mode: NoteLengthMode): Promise<void>
  chooseWorkspaceDir(): Promise<void>
  openFolder(target: 'workspace' | 'projects' | 'exports' | 'packs'): Promise<void>
  saveProject(): Promise<boolean>
  openProject(): Promise<boolean>

  // UI state
  setViewMode(mode: ViewMode): void
  setSettingsOpen(open: boolean): void
  setGridDivision(division: GridDivision): void
  setLastNoteDurationTick(ticks: number): void
  setIsPlaying(playing: boolean): void
  setSelectedTrackId(trackId: string): void
  setSelectedNoteIds(noteIds: string[]): void
  clearStatusMessage(): void

  // Project mutations (recorded in Undo/Redo)
  setTitle(title: string): void
  setBpm(bpm: number): void
  setBars(bars: number): void
  toggleLoop(): void
  addTrack(type: TrackType): void
  removeTrack(trackId: string): void
  updateTrack(trackId: string, patch: Partial<Omit<Track, 'id' | 'notes'>>): void
  toggleMute(trackId: string): void
  toggleSolo(trackId: string): void

  // Note mutations (recorded in Undo/Redo)
  addNote(trackId: string, note: Omit<Note, 'id'>): Note
  updateNote(trackId: string, noteId: string, patch: Partial<Omit<Note, 'id'>>): void
  deleteSelectedNotes(): void
  deleteNote(trackId: string, noteId: string): void
  moveSelectedNotes(deltaTick: number, deltaPitch: number): void
  copySelectedNotes(): void
  pasteNotes(targetTick: number): void
  commitProjectSnapshot(nextProject: Project): void

  // History
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export interface ProjectStoreDeps {
  platform: PlatformAdapter
  codecs: CodecRegistry
  onThemeChanged?: (merged: MergedPackConfig) => void
}

const INITIAL_MERGED: MergedPackConfig = {
  activePackIds: ['default-minimal'],
  tokens: {},
  overrideCss: '',
  visualizer: FALLBACK_VISUALIZER_PRESET,
  instruments: [
    {
      id: 'soft-sine',
      name: 'Soft Sine',
      type: 'synth',
      synth: { waveform: 'sine', attack: 0.012, decay: 0.18, sustain: 0.55, release: 0.22 }
    },
    { id: 'basic-kit', name: 'Basic Rhythm Kit', type: 'drum' }
  ]
}

export function createProjectStore(deps: ProjectStoreDeps) {
  const initialProject = createDemoProject()

  return createStore<ProjectStoreState>((set, get) => {
    const commit = (updater: (prev: Project) => Project): void => {
      const state = get()
      const nextProject = updater(state.project)
      const nextHistory = pushHistory(state.history, nextProject)
      set({ history: nextHistory, project: nextProject })
    }

    return {
      history: createHistory(initialProject),
      project: initialProject,
      selectedTrackId: initialProject.tracks[0]?.id ?? '',
      selectedNoteIds: [],
      clipboardNotes: [],
      gridDivision: '1/16',
      lastNoteDurationTick: PPQN / 2,
      viewMode: 'edit',
      settingsOpen: false,
      isPlaying: false,
      statusMessage: null,

      settings: {
        workspaceDir: '',
        activePackIds: ['default-minimal'],
        noteLengthMode: 'last-used'
      },
      availablePacks: [],
      mergedPacks: INITIAL_MERGED,

      async initialize() {
        try {
          const settings = await deps.platform.loadSettings()
          const packs = await deps.platform.listResourcePacks()
          const merged = mergeResourcePacks(packs, settings.activePackIds)
          set({
            settings: { ...settings, activePackIds: merged.activePackIds },
            availablePacks: packs,
            mergedPacks: merged
          })
          deps.onThemeChanged?.(merged)
        } catch (err) {
          set({
            statusMessage: `初期化エラー: ${err instanceof Error ? err.message : String(err)}`
          })
        }
      },

      async reloadPacks() {
        const packs = await deps.platform.listResourcePacks()
        const { settings } = get()
        const merged = mergeResourcePacks(packs, settings.activePackIds)
        set({ availablePacks: packs, mergedPacks: merged, statusMessage: 'リソースパックを再読み込みしました' })
        deps.onThemeChanged?.(merged)
      },

      async setActivePackIds(packIds) {
        const { availablePacks, settings } = get()
        const merged = mergeResourcePacks(availablePacks, packIds)
        const nextSettings: AppSettings = {
          ...settings,
          activePackIds: merged.activePackIds
        }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings, mergedPacks: merged })
        deps.onThemeChanged?.(merged)
      },

      async setNoteLengthMode(mode) {
        const { settings } = get()
        const nextSettings: AppSettings = { ...settings, noteLengthMode: mode }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings })
      },

      async chooseWorkspaceDir() {
        const chosen = await deps.platform.chooseWorkspaceDir()
        if (!chosen) return
        const { settings } = get()
        const nextSettings: AppSettings = { ...settings, workspaceDir: chosen }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings, statusMessage: '保存先フォルダを変更しました' })
        await get().reloadPacks()
      },

      async openFolder(target) {
        await deps.platform.openFolder(target)
      },

      async saveProject() {
        const { project } = get()
        const safeName = (project.title.trim() || 'untitled').replace(/[\\/:*?"<>|]/g, '_')
        const encoded = deps.codecs.encodeDefault(project)
        const result = await deps.platform.saveProjectFile(`${safeName}.tonebone.json`, encoded)
        if (!result.canceled) {
          set({ statusMessage: 'プロジェクトを保存しました' })
          return true
        }
        return false
      },

      async openProject() {
        const result = await deps.platform.openProjectFile()
        if (result.canceled || !result.content) return false
        try {
          const { project } = deps.codecs.decodeAuto(result.content)
          set({
            history: createHistory(project),
            project,
            selectedTrackId: project.tracks[0]?.id ?? '',
            selectedNoteIds: [],
            statusMessage: `「${project.title}」を読み込みました`
          })
          return true
        } catch (err) {
          set({
            statusMessage: `読み込み失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return false
        }
      },

      setViewMode: (viewMode) => set({ viewMode }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setGridDivision: (gridDivision) => set({ gridDivision }),
      setLastNoteDurationTick: (ticks) => set({ lastNoteDurationTick: Math.max(30, Math.round(ticks)) }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId, selectedNoteIds: [] }),
      setSelectedNoteIds: (selectedNoteIds) => set({ selectedNoteIds }),
      clearStatusMessage: () => set({ statusMessage: null }),

      setTitle: (title) => commit((p) => ({ ...p, title })),
      setBpm: (bpm) => commit((p) => ({ ...p, bpm: clamp(Math.round(bpm), 40, 300) })),
      setBars: (bars) => commit((p) => ({ ...p, bars: clamp(Math.round(bars), 1, 32) })),
      toggleLoop: () => commit((p) => ({ ...p, loopEnabled: !p.loopEnabled })),

      addTrack: (type) => {
        const { project, mergedPacks } = get()
        const matchingInst = mergedPacks.instruments.find((i) => i.type === type)
        const newTrack: Track = {
          id: createId('track'),
          name: type === 'drum' ? `Rhythm ${project.tracks.length + 1}` : `Synth ${project.tracks.length + 1}`,
          type,
          instrumentId: matchingInst?.id ?? (type === 'drum' ? 'basic-kit' : 'soft-sine'),
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
        if (track?.type === 'synth') {
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
        if (track?.type === 'synth' && typeof patch.durationTick === 'number') {
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
            t.id === selectedTrackId
              ? { ...t, notes: t.notes.filter((n) => !idSet.has(n.id)) }
              : t
          )
        }))
        set({ selectedNoteIds: [] })
      },

      moveSelectedNotes: (deltaTick, deltaPitch) => {
        const { project, selectedTrackId, selectedNoteIds } = get()
        if (selectedNoteIds.length === 0 || (deltaTick === 0 && deltaPitch === 0)) return
        const track = project.tracks.find((t) => t.id === selectedTrackId)
        if (!track) return
        const minPitch = track.type === 'drum' ? 0 : 24
        const maxPitch = track.type === 'drum' ? DRUM_LANES.length - 1 : 96
        const maxTicks = project.bars * TICKS_PER_BAR
        const idSet = new Set(selectedNoteIds)

        commit((p) => ({
          ...p,
          tracks: p.tracks.map((t) =>
            t.id === selectedTrackId
              ? {
                  ...t,
                  notes: moveNotes(t.notes, idSet, deltaTick, deltaPitch, minPitch, maxPitch, maxTicks)
                }
              : t
          )
        }))
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
        if (clipboardNotes.length === 0) return
        const maxTicks = project.bars * TICKS_PER_BAR
        const pasted = cloneNotesForPaste(clipboardNotes, targetTick, maxTicks, () =>
          createId('note')
        )
        if (pasted.length === 0) return
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
      },

      commitProjectSnapshot: (nextProject) => {
        const state = get()
        const nextHistory = pushHistory(state.history, nextProject)
        set({ history: nextHistory, project: nextProject })
      },

      undo: () => {
        const { history } = get()
        if (!canUndo(history)) return
        const prev = undoHistory(history)
        set({ history: prev, project: prev.present, selectedNoteIds: [] })
      },

      redo: () => {
        const { history } = get()
        if (!canRedo(history)) return
        const next = redoHistory(history)
        set({ history: next, project: next.present, selectedNoteIds: [] })
      },

      canUndo: () => canUndo(get().history),
      canRedo: () => canRedo(get().history)
    }
  })
}

export const defaultPlatform = new ElectronPlatformAdapter()
export const defaultCodecRegistry = createDefaultCodecRegistry()

export const projectStore = createProjectStore({
  platform: defaultPlatform,
  codecs: defaultCodecRegistry
})

export function useProjectStore<T>(selector: (state: ProjectStoreState) => T): T {
  return useStore(projectStore, selector)
}
