import {
  DEFAULT_SOUND_PACK_ID,
  DEFAULT_THEME_PACK_ID,
  type AppSettings
} from '@core/types'
import { mergeSoundPacks, mergeThemePacks } from '@packs/packMerger'
import { INITIAL_MERGED_SOUNDS, INITIAL_MERGED_THEME } from '../helpers'
import type { SettingsSlice, SliceRuntime, StoreGet, StoreSet } from '../types'

export function createSettingsSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: SliceRuntime
): SettingsSlice {
  const { deps, saveStrategies, notifyProjectChanged } = runtime

  return {
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

    async updateSettings(patch) {
      const { settings, availableThemePacks, availableSoundPacks } = get()
      if (patch.saveMode !== undefined) {
        saveStrategies.disposeAll()
      }

      const nextSettings: AppSettings = { ...settings, ...patch }
      const statePatch: Partial<SettingsSlice> = {}

      if (patch.activeThemePackIds !== undefined) {
        const mergedTheme = mergeThemePacks(availableThemePacks, patch.activeThemePackIds)
        nextSettings.activeThemePackIds = mergedTheme.activeThemePackIds
        statePatch.mergedTheme = mergedTheme
      }

      if (patch.activeSoundPackIds !== undefined) {
        const mergedSounds = mergeSoundPacks(availableSoundPacks, patch.activeSoundPackIds)
        nextSettings.activeSoundPackIds = mergedSounds.activeSoundPackIds
        statePatch.mergedSounds = mergedSounds
      }

      await deps.platform.saveSettings(nextSettings)
      set({ ...statePatch, settings: nextSettings })

      if (statePatch.mergedTheme) {
        deps.onThemeChanged?.(statePatch.mergedTheme)
      }
      if (patch.saveMode === 'auto' && get().isDirty && get().currentFilePath) {
        notifyProjectChanged()
      }
    },

    async chooseWorkspaceDir() {
      const chosen = await deps.platform.chooseWorkspaceDir()
      if (!chosen) return
      await get().updateSettings({ workspaceDir: chosen })
      set({ statusMessage: '保存先フォルダを変更しました' })
      await get().reloadThemePacks()
      await get().reloadSoundPacks()
      await get().refreshWorkspaceProjects()
    },

    async openFolder(target) {
      await deps.platform.openFolder(target)
    }
  }
}
