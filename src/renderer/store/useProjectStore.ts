import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { createDemoProject, createEmptyProject } from '@core/demoProject'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory
} from '@core/history'
import { clamp, cloneNotesForPaste, moveNotes } from '@core/musicMath'
import {
  DEFAULT_SOUND_PACK_ID,
  DEFAULT_THEME_PACK_ID,
  DRUM_LANES,
  MAX_BARS,
  PPQN,
  TICKS_PER_BAR,
  type AppSettings,
  type Note,
  type Track
} from '@core/types'
import { mergeSoundPacks, mergeThemePacks } from '@packs/packMerger'
import { createDefaultSaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import type { LeaveDecision } from '@persistence/types'
import { ElectronPlatformAdapter } from '@platform/ElectronPlatformAdapter'
import {
  createId,
  createSliceRuntime,
  INITIAL_MERGED_SOUNDS,
  INITIAL_MERGED_THEME
} from './helpers'
import type {
  ProjectStoreDeps,
  ProjectStoreState,
  UnsavedChangesPrompt,
  ViewMode
} from './types'

export type {
  ProjectStoreDeps,
  ProjectStoreState,
  UnsavedChangesPrompt,
  ViewMode
}

export function createProjectStore(deps: ProjectStoreDeps) {
  const initialProject = createDemoProject()
  const saveStrategies = deps.saveStrategies ?? createDefaultSaveStrategyRegistry()

  return createStore<ProjectStoreState>((set, get) => {
    const { createSaveContext, notifyProjectChanged, commit } = createSliceRuntime(
      set,
      get,
      deps,
      saveStrategies
    )

    return {
      history: createHistory(initialProject),
      project: initialProject,
      selectedTrackId: initialProject.tracks[0]?.id ?? '',
      selectedNoteIds: [],
      clipboardNotes: [],
      gridDivision: '1/16',
      lastNoteDurationTick: PPQN / 2,
      viewMode: 'home',
      settingsOpen: false,
      isPlaying: false,
      isAutoSaving: false,
      statusMessage: null,
      currentFilePath: null,
      isDirty: false,

      settings: {
        workspaceDir: '',
        activeThemePackIds: [DEFAULT_THEME_PACK_ID],
        activeSoundPackIds: [DEFAULT_SOUND_PACK_ID],
        noteLengthMode: 'last-used',
        saveMode: 'auto'
      },
      availableThemePacks: [],
      mergedTheme: INITIAL_MERGED_THEME,
      availableSoundPacks: [],
      mergedSounds: INITIAL_MERGED_SOUNDS,
      workspaceProjects: [],
      selectedHomeProjectPath: null,
      unsavedPrompt: null,

      async initialize() {
        try {
          const settings = await deps.platform.loadSettings()
          const [themePacks, soundPacks, projects] = await Promise.all([
            deps.platform.listThemePacks(),
            deps.platform.listSoundPacks(),
            deps.platform.listWorkspaceProjects()
          ])
          const mergedTheme = mergeThemePacks(themePacks, settings.activeThemePackIds)
          const mergedSounds = mergeSoundPacks(soundPacks, settings.activeSoundPackIds)
          set({
            settings: {
              ...settings,
              activeThemePackIds: mergedTheme.activeThemePackIds,
              activeSoundPackIds: mergedSounds.activeSoundPackIds
            },
            availableThemePacks: themePacks,
            mergedTheme,
            availableSoundPacks: soundPacks,
            mergedSounds,
            workspaceProjects: projects,
            selectedHomeProjectPath: projects[0]?.filePath ?? null
          })
          deps.onThemeChanged?.(mergedTheme)
        } catch (err) {
          set({
            statusMessage: `初期化エラー: ${err instanceof Error ? err.message : String(err)}`
          })
        }
      },

      async reloadThemePacks() {
        const themePacks = await deps.platform.listThemePacks()
        const { settings } = get()
        const mergedTheme = mergeThemePacks(themePacks, settings.activeThemePackIds)
        set({
          availableThemePacks: themePacks,
          mergedTheme,
          statusMessage: 'テーマパックを再読み込みしました'
        })
        deps.onThemeChanged?.(mergedTheme)
      },

      async reloadSoundPacks() {
        const soundPacks = await deps.platform.listSoundPacks()
        const { settings } = get()
        const mergedSounds = mergeSoundPacks(soundPacks, settings.activeSoundPackIds)
        set({
          availableSoundPacks: soundPacks,
          mergedSounds,
          statusMessage: '音源パックを再読み込みしました'
        })
      },

      async refreshWorkspaceProjects() {
        try {
          const projects = await deps.platform.listWorkspaceProjects()
          const currentSelected = get().selectedHomeProjectPath
          const stillExists =
            currentSelected !== null && projects.some((p) => p.filePath === currentSelected)
          set({
            workspaceProjects: projects,
            selectedHomeProjectPath: stillExists ? currentSelected : (projects[0]?.filePath ?? null)
          })
        } catch (err) {
          set({
            statusMessage: `プロジェクト一覧の取得失敗: ${err instanceof Error ? err.message : String(err)}`
          })
        }
      },

      async setActiveThemePackIds(packIds) {
        const { availableThemePacks, settings } = get()
        const mergedTheme = mergeThemePacks(availableThemePacks, packIds)
        const nextSettings: AppSettings = {
          ...settings,
          activeThemePackIds: mergedTheme.activeThemePackIds
        }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings, mergedTheme })
        deps.onThemeChanged?.(mergedTheme)
      },

      async setActiveSoundPackIds(packIds) {
        const { availableSoundPacks, settings } = get()
        const mergedSounds = mergeSoundPacks(availableSoundPacks, packIds)
        const nextSettings: AppSettings = {
          ...settings,
          activeSoundPackIds: mergedSounds.activeSoundPackIds
        }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings, mergedSounds })
      },

      async setNoteLengthMode(mode) {
        const { settings } = get()
        const nextSettings: AppSettings = { ...settings, noteLengthMode: mode }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings })
      },

      async setSaveMode(mode) {
        saveStrategies.disposeAll()
        const { settings } = get()
        const nextSettings: AppSettings = { ...settings, saveMode: mode }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings })
        if (mode === 'auto' && get().isDirty && get().currentFilePath) {
          notifyProjectChanged()
        }
      },

      async chooseWorkspaceDir() {
        const chosen = await deps.platform.chooseWorkspaceDir()
        if (!chosen) return
        const { settings } = get()
        const nextSettings: AppSettings = { ...settings, workspaceDir: chosen }
        await deps.platform.saveSettings(nextSettings)
        set({ settings: nextSettings, statusMessage: '保存先フォルダを変更しました' })
        await get().reloadThemePacks()
        await get().reloadSoundPacks()
        await get().refreshWorkspaceProjects()
      },

      async openFolder(target) {
        await deps.platform.openFolder(target)
      },

      setSelectedHomeProjectPath: (selectedHomeProjectPath) => set({ selectedHomeProjectPath }),

      async openWorkspaceProject(filePath) {
        saveStrategies.disposeAll()
        try {
          const result = await deps.platform.readWorkspaceProject(filePath)
          if (result.canceled || !result.content) {
            set({ statusMessage: 'プロジェクトを開けませんでした' })
            return false
          }
          const { project } = deps.codecs.decodeAuto(result.content)
          set({
            history: createHistory(project),
            project,
            selectedTrackId: project.tracks[0]?.id ?? '',
            selectedNoteIds: [],
            clipboardNotes: [],
            currentFilePath: result.filePath ?? filePath,
            selectedHomeProjectPath: result.filePath ?? filePath,
            isDirty: false,
            viewMode: 'edit'
          })
          return true
        } catch (err) {
          set({
            statusMessage: `読み込み失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return false
        }
      },

      async createWorkspaceProject(template, options = { openImmediately: true }) {
        try {
          const draft = template === 'demo' ? createDemoProject() : createEmptyProject()
          const encoded = deps.codecs.encodeDefault(draft)
          const summary = await deps.platform.createWorkspaceProject(draft.title, encoded)
          await get().refreshWorkspaceProjects()
          set({ selectedHomeProjectPath: summary.filePath })

          if (options.openImmediately) {
            await get().openWorkspaceProject(summary.filePath)
          } else {
            set({ statusMessage: `「${summary.title}」を作成しました` })
          }
          return summary
        } catch (err) {
          set({
            statusMessage: `作成失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return null
        }
      },

      async renameWorkspaceProject(filePath, newTitle) {
        try {
          const updated = await deps.platform.renameWorkspaceProject(filePath, newTitle)
          const { currentFilePath, project } = get()
          if (currentFilePath === filePath) {
            set({
              currentFilePath: updated.filePath,
              project: { ...project, title: updated.title }
            })
          }
          await get().refreshWorkspaceProjects()
          set({
            selectedHomeProjectPath: updated.filePath,
            statusMessage: `「${updated.title}」に名前を変更しました`
          })
          return true
        } catch (err) {
          set({
            statusMessage: err instanceof Error ? err.message : String(err)
          })
          return false
        }
      },

      async duplicateWorkspaceProject(filePath) {
        try {
          const copy = await deps.platform.duplicateWorkspaceProject(filePath)
          await get().refreshWorkspaceProjects()
          set({
            selectedHomeProjectPath: copy.filePath,
            statusMessage: `「${copy.title}」を複製しました`
          })
          return copy
        } catch (err) {
          set({
            statusMessage: `複製失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return null
        }
      },

      async deleteWorkspaceProject(filePath) {
        try {
          await deps.platform.deleteWorkspaceProject(filePath)
          if (get().currentFilePath === filePath) {
            set({ currentFilePath: null })
          }
          await get().refreshWorkspaceProjects()
          set({ statusMessage: 'プロジェクトをゴミ箱へ移動しました' })
          return true
        } catch (err) {
          set({
            statusMessage: `削除失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return false
        }
      },

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

      async prepareLeaveCurrentProject(askDecision) {
        const strategy = saveStrategies.get(get().settings.saveMode)
        return strategy.prepareLeave(() => createSaveContext(askDecision))
      },

      async returnToHome(askDecision) {
        const canLeave = await get().prepareLeaveCurrentProject(askDecision)
        if (!canLeave) return false
        const lastPath = get().currentFilePath
        set({ viewMode: 'home', selectedNoteIds: [] })
        await get().refreshWorkspaceProjects()
        if (lastPath && get().workspaceProjects.some((p) => p.filePath === lastPath)) {
          set({ selectedHomeProjectPath: lastPath })
        }
        return true
      },

      async saveProjectQuietly() {
        const { project, currentFilePath } = get()
        if (!currentFilePath) return false
        set({ isAutoSaving: true })
        try {
          const encoded = deps.codecs.encodeDefault(project)
          const result = await deps.platform.writeProjectFile(currentFilePath, encoded)
          if (!result.canceled) {
            set({ isDirty: false, isAutoSaving: false })
            return true
          }
          set({ isAutoSaving: false })
          return false
        } catch (err) {
          set({
            isAutoSaving: false,
            statusMessage: `自動保存失敗: ${err instanceof Error ? err.message : String(err)}`
          })
          return false
        }
      },

      async saveProject() {
        saveStrategies.disposeAll()
        const { project, currentFilePath } = get()
        if (currentFilePath) {
          try {
            const encoded = deps.codecs.encodeDefault(project)
            const result = await deps.platform.writeProjectFile(currentFilePath, encoded)
            if (!result.canceled) {
              set({ isDirty: false, statusMessage: '上書き保存しました' })
              return true
            }
            return false
          } catch {
            // Fall back to Save As dialog if target path is no longer writable
            return get().saveProjectAs()
          }
        }
        return get().saveProjectAs()
      },

      async saveProjectAs() {
        saveStrategies.disposeAll()
        const { project } = get()
        const safeName = (project.title.trim() || 'untitled').replace(/[\\/:*?"<>|]/g, '_')
        const encoded = deps.codecs.encodeDefault(project)
        const result = await deps.platform.saveProjectFile(`${safeName}.json`, encoded)
        if (!result.canceled && result.filePath) {
          set({
            currentFilePath: result.filePath,
            isDirty: false,
            statusMessage: 'プロジェクトを保存しました'
          })
          return true
        }
        return false
      },

      async openProject() {
        saveStrategies.disposeAll()
        const result = await deps.platform.openProjectFile()
        if (result.canceled || !result.content) return false
        try {
          const { project } = deps.codecs.decodeAuto(result.content)
          set({
            history: createHistory(project),
            project,
            selectedTrackId: project.tracks[0]?.id ?? '',
            selectedNoteIds: [],
            clipboardNotes: [],
            currentFilePath: result.filePath ?? null,
            isDirty: false,
            viewMode: 'edit',
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

      newProject() {
        saveStrategies.disposeAll()
        const fresh = createEmptyProject()
        set({
          history: createHistory(fresh),
          project: fresh,
          selectedTrackId: fresh.tracks[0]?.id ?? '',
          selectedNoteIds: [],
          clipboardNotes: [],
          currentFilePath: null,
          isDirty: false,
          viewMode: 'edit',
          statusMessage: '新規プロジェクトを作成しました'
        })
      },

      setViewMode: (viewMode) => set({ viewMode }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setGridDivision: (gridDivision) => set({ gridDivision }),
      setLastNoteDurationTick: (ticks) =>
        set({ lastNoteDurationTick: Math.max(30, Math.round(ticks)) }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId, selectedNoteIds: [] }),
      setSelectedNoteIds: (selectedNoteIds) => set({ selectedNoteIds }),
      clearStatusMessage: () => set({ statusMessage: null }),

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
        const matchingInst = mergedSounds.instruments.find((i) => i.type === type)
        const newTrack: Track = {
          id: createId('track'),
          name:
            type === 'drum'
              ? `Rhythm ${project.tracks.length + 1}`
              : `Synth ${project.tracks.length + 1}`,
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
          tracks: p.tracks.map((t) =>
            t.id === trackId ? { ...t, notes: [...t.notes, note] } : t
          )
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
                  notes: moveNotes(
                    t.notes,
                    idSet,
                    deltaTick,
                    deltaPitch,
                    minPitch,
                    maxPitch,
                    maxTicks
                  )
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
  })
}

export const defaultPlatform = new ElectronPlatformAdapter()
export const defaultCodecRegistry = createDefaultCodecRegistry()
export const defaultSaveStrategyRegistry = createDefaultSaveStrategyRegistry()

export const projectStore = createProjectStore({
  platform: defaultPlatform,
  codecs: defaultCodecRegistry,
  saveStrategies: defaultSaveStrategyRegistry
})

export function useProjectStore<T>(selector: (state: ProjectStoreState) => T): T {
  return useStore(projectStore, selector)
}
