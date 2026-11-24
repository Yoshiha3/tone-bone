import type {
  AppSettings,
  ProjectSummary,
  SoundPack,
  ThemePack,
  WorkspaceFolderTarget
} from '@core/types'

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
}

export interface OpenFileResult {
  canceled: boolean
  filePath?: string
  content?: string
}

export interface ExportFileOptions {
  suggestedName: string
  filterName: string
  extension: string
  data: Uint8Array
}

export interface PlatformAdapter {
  saveProjectFile(suggestedName: string, content: string): Promise<SaveFileResult>
  writeProjectFile(filePath: string, content: string): Promise<SaveFileResult>
  openProjectFile(): Promise<OpenFileResult>
  saveExportFile(options: ExportFileOptions): Promise<SaveFileResult>
  loadSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  chooseWorkspaceDir(): Promise<string | null>
  openFolder(target: WorkspaceFolderTarget): Promise<void>
  listThemePacks(): Promise<ThemePack[]>
  listSoundPacks(): Promise<SoundPack[]>
  listWorkspaceProjects(): Promise<ProjectSummary[]>
  readWorkspaceProject(filePath: string): Promise<OpenFileResult>
  createWorkspaceProject(baseTitle: string, content: string): Promise<ProjectSummary>
  renameWorkspaceProject(filePath: string, newTitle: string): Promise<ProjectSummary>
  duplicateWorkspaceProject(filePath: string): Promise<ProjectSummary>
  deleteWorkspaceProject(filePath: string): Promise<void>
}
