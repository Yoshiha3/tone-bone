import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { createDemoProject } from '@core/demoProject'
import { createDefaultSaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import { ElectronPlatformAdapter } from '@platform/ElectronPlatformAdapter'
import { createSliceRuntime } from './helpers'
import { createProjectSlice } from './slices/projectSlice'
import { createSettingsSlice } from './slices/settingsSlice'
import { createUiSlice } from './slices/uiSlice'
import { createWorkspaceSlice } from './slices/workspaceSlice'
import type {
  ProjectSlice,
  ProjectStoreDeps,
  ProjectStoreState,
  SettingsSlice,
  UiSlice,
  UnsavedChangesPrompt,
  ViewMode,
  WorkspaceSlice
} from './types'

export type {
  ProjectSlice,
  ProjectStoreDeps,
  ProjectStoreState,
  SettingsSlice,
  UiSlice,
  UnsavedChangesPrompt,
  ViewMode,
  WorkspaceSlice
}

export function createProjectStore(deps: ProjectStoreDeps) {
  const initialProject = createDemoProject()
  const saveStrategies = deps.saveStrategies ?? createDefaultSaveStrategyRegistry()

  return createStore<ProjectStoreState>((set, get) => {
    const runtime = createSliceRuntime(set, get, deps, saveStrategies)

    return {
      ...createUiSlice(set, get, initialProject.tracks[0]?.id ?? ''),
      ...createSettingsSlice(set, get, runtime),
      ...createProjectSlice(set, get, runtime, initialProject),
      ...createWorkspaceSlice(set, get, runtime)
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
