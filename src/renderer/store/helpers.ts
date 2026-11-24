import { pushHistory } from '@core/history'
import {
  DEFAULT_SOUND_PACK_ID,
  DEFAULT_THEME_PACK_ID,
  type MergedSoundConfig,
  type MergedThemeConfig,
  type Project
} from '@core/types'
import { FALLBACK_VISUALIZER_PRESET } from '@packs/packMerger'
import type { SaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import type { LeaveDecision, SaveContext } from '@persistence/types'
import type { ProjectStoreDeps, SliceRuntime, StoreGet, StoreSet } from './types'

let idCounter = 1

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${idCounter++}`
}

export const INITIAL_MERGED_THEME: MergedThemeConfig = {
  activeThemePackIds: [DEFAULT_THEME_PACK_ID],
  tokens: {},
  overrideCss: '',
  visualizer: FALLBACK_VISUALIZER_PRESET
}

export const INITIAL_MERGED_SOUNDS: MergedSoundConfig = {
  activeSoundPackIds: [DEFAULT_SOUND_PACK_ID],
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

export function createSliceRuntime(
  set: StoreSet,
  get: StoreGet,
  deps: ProjectStoreDeps,
  saveStrategies: SaveStrategyRegistry
): SliceRuntime {
  const createSaveContext = (askLeaveDecision: () => Promise<LeaveDecision>): SaveContext => ({
    get hasFilePath() {
      return Boolean(get().currentFilePath)
    },
    get isDirty() {
      return get().isDirty
    },
    saveQuietly: () => get().saveProjectQuietly(),
    saveExplicitly: () => get().saveProject(),
    askLeaveDecision
  })

  const notifyProjectChanged = (): void => {
    const strategy = saveStrategies.get(get().settings.saveMode)
    strategy.onProjectChanged(() => createSaveContext(async () => 'cancel'))
  }

  const commit = (updater: (prev: Project) => Project): void => {
    const state = get()
    const nextProject = updater(state.project)
    const nextHistory = pushHistory(state.history, nextProject)
    set({ history: nextHistory, project: nextProject, isDirty: true })
    notifyProjectChanged()
  }

  return {
    deps,
    saveStrategies,
    createSaveContext,
    notifyProjectChanged,
    commit
  }
}
