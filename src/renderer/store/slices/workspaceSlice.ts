import { createDemoProject, createEmptyProject } from '@core/demoProject'
import { mergeSoundPacks, mergeThemePacks } from '@packs/packMerger'
import { buildLoadedProjectState, formatError } from '../helpers'
import type { SliceRuntime, StoreGet, StoreSet, WorkspaceSlice } from '../types'

export function createWorkspaceSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: SliceRuntime
): WorkspaceSlice {
  const { deps, saveStrategies, createSaveContext } = runtime

  return {
    isAutoSaving: false,
    currentFilePath: null,
    isDirty: false,
    workspaceProjects: [],

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
          statusMessage: `初期化エラー: ${formatError(err)}`
        })
      }
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
          statusMessage: `プロジェクト一覧の取得失敗: ${formatError(err)}`
        })
      }
    },

    async openWorkspaceProject(filePath) {
      saveStrategies.disposeAll()
      try {
        const result = await deps.platform.readWorkspaceProject(filePath)
        if (result.canceled || !result.content) {
          set({ statusMessage: 'プロジェクトを開けませんでした' })
          return false
        }
        const { project } = deps.codecs.decodeAuto(result.content)
        const resolvedPath = result.filePath ?? filePath
        set({
          ...buildLoadedProjectState(project, resolvedPath),
          selectedHomeProjectPath: resolvedPath
        })
        return true
      } catch (err) {
        set({
          statusMessage: `読み込み失敗: ${formatError(err)}`
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
          statusMessage: `作成失敗: ${formatError(err)}`
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
          statusMessage: formatError(err)
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
          statusMessage: `複製失敗: ${formatError(err)}`
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
          statusMessage: `削除失敗: ${formatError(err)}`
        })
        return false
      }
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
          statusMessage: `自動保存失敗: ${formatError(err)}`
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
      const defaultCodec = deps.codecs.getDefault()
      const ext = deps.codecs.getDefaultExtension()
      const encoded = deps.codecs.encodeDefault(project)
      const result = await deps.platform.saveProjectFile({
        suggestedName: `${safeName}.${ext}`,
        content: encoded,
        filters: [
          {
            name: defaultCodec.label,
            extensions: defaultCodec.extensions.map((e) => e.replace(/^\./, '').toLowerCase())
          }
        ]
      })
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
      const result = await deps.platform.openProjectFile({
        filters: deps.codecs.getFileFilters()
      })
      if (result.canceled || !result.content) return false
      try {
        const { project } = deps.codecs.decodeAuto(result.content)
        set({
          ...buildLoadedProjectState(project, result.filePath ?? null),
          statusMessage: `「${project.title}」を読み込みました`
        })
        return true
      } catch (err) {
        set({
          statusMessage: `読み込み失敗: ${formatError(err)}`
        })
        return false
      }
    },

    newProject() {
      saveStrategies.disposeAll()
      const fresh = createEmptyProject()
      set({
        ...buildLoadedProjectState(fresh, null),
        statusMessage: '新規プロジェクトを作成しました'
      })
    }
  }
}
