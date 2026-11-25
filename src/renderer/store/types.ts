import type { StoreApi } from 'zustand/vanilla'
import type { CodecRegistry } from '@codecs/CodecRegistry'
import type { HistoryStack } from '@core/history'
import type {
  AppSettings,
  GridDivision,
  MergedSoundConfig,
  MergedThemeConfig,
  Note,
  Project,
  ProjectSummary,
  SoundPack,
  ThemePack,
  Track,
  TrackType,
  WorkspaceFolderTarget
} from '@core/types'
import type { SaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import type { LeaveDecision, SaveContext } from '@persistence/types'
import type { PlatformAdapter } from '@platform/types'

export type ViewMode = 'home' | 'edit' | 'stage'

export interface UnsavedChangesPrompt {
  message: string
  saveLabel: string
  discardLabel: string
  resolve: (decision: LeaveDecision) => void
}

export interface UiSlice {
  selectedTrackId: string
  selectedNoteIds: string[]
  clipboardNotes: Note[]
  gridDivision: GridDivision
  lastNoteDurationTick: number
  viewMode: ViewMode
  settingsOpen: boolean
  isPlaying: boolean
  statusMessage: string | null
  selectedHomeProjectPath: string | null
  unsavedPrompt: UnsavedChangesPrompt | null

  setSelectedHomeProjectPath(filePath: string | null): void
  requestLeaveDecision(prompt: Omit<UnsavedChangesPrompt, 'resolve'>): Promise<LeaveDecision>
  resolveLeaveDecision(decision: LeaveDecision): void
  setViewMode(mode: ViewMode): void
  setSettingsOpen(open: boolean): void
  setGridDivision(division: GridDivision): void
  setLastNoteDurationTick(ticks: number): void
  setIsPlaying(playing: boolean): void
  setSelectedTrackId(trackId: string): void
  setSelectedNoteIds(noteIds: string[]): void
  clearStatusMessage(): void
}

export interface SettingsSlice {
  settings: AppSettings
  availableThemePacks: ThemePack[]
  mergedTheme: MergedThemeConfig
  availableSoundPacks: SoundPack[]
  mergedSounds: MergedSoundConfig

  reloadThemePacks(): Promise<void>
  reloadSoundPacks(): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
  chooseWorkspaceDir(): Promise<void>
  openFolder(target: WorkspaceFolderTarget): Promise<void>
}

export interface ProjectSlice {
  history: HistoryStack<Project>
  project: Project

  setTitle(title: string): void
  setBpm(bpm: number): void
  setBars(bars: number): void
  toggleLoop(): void
  addTrack(type: TrackType): void
  removeTrack(trackId: string): void
  reorderTracks(fromIndex: number, toIndex: number): void
  updateTrack(trackId: string, patch: Partial<Omit<Track, 'id' | 'notes'>>): void
  toggleMute(trackId: string): void
  toggleSolo(trackId: string): void

  addNote(trackId: string, note: Omit<Note, 'id'>): Note
  updateNote(trackId: string, noteId: string, patch: Partial<Omit<Note, 'id'>>): void
  deleteSelectedNotes(): void
  deleteNote(trackId: string, noteId: string): void
  moveSelectedNotes(deltaTick: number, deltaPitch: number): void
  copySelectedNotes(): void
  pasteNotes(targetTick: number): void
  commitProjectSnapshot(nextProject: Project): void

  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export interface WorkspaceSlice {
  isAutoSaving: boolean
  currentFilePath: string | null
  isDirty: boolean
  workspaceProjects: ProjectSummary[]

  initialize(): Promise<void>
  refreshWorkspaceProjects(): Promise<void>
  openWorkspaceProject(filePath: string): Promise<boolean>
  createWorkspaceProject(
    template: 'empty' | 'demo',
    options?: { openImmediately?: boolean }
  ): Promise<ProjectSummary | null>
  renameWorkspaceProject(filePath: string, newTitle: string): Promise<boolean>
  duplicateWorkspaceProject(filePath: string): Promise<ProjectSummary | null>
  deleteWorkspaceProject(filePath: string): Promise<boolean>
  prepareLeaveCurrentProject(askDecision: () => Promise<LeaveDecision>): Promise<boolean>
  returnToHome(askDecision: () => Promise<LeaveDecision>): Promise<boolean>

  saveProject(): Promise<boolean>
  saveProjectQuietly(): Promise<boolean>
  saveProjectAs(): Promise<boolean>
  openProject(): Promise<boolean>
  newProject(): void
}

export type ProjectStoreState = UiSlice & SettingsSlice & ProjectSlice & WorkspaceSlice

export interface ProjectStoreDeps {
  platform: PlatformAdapter
  codecs: CodecRegistry
  saveStrategies?: SaveStrategyRegistry
  onThemeChanged?: (merged: MergedThemeConfig) => void
}

export type StoreSet = StoreApi<ProjectStoreState>['setState']
export type StoreGet = StoreApi<ProjectStoreState>['getState']

export interface SliceRuntime {
  deps: ProjectStoreDeps
  saveStrategies: SaveStrategyRegistry
  createSaveContext: (askLeaveDecision: () => Promise<LeaveDecision>) => SaveContext
  notifyProjectChanged: () => void
  commit: (updater: (prev: Project) => Project) => void
}
