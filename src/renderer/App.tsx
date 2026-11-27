import { useEffect } from 'react'
import { applyPackTheme } from '@packs/themeApplier'
import { requestNewProject, togglePlayPause } from './actions'
import { audioEngine } from './audioContext'
import { HomeView } from './components/HomeView'
import { PianoRoll } from './components/PianoRoll'
import { SettingsModal } from './components/SettingsModal'
import { StageVisualizer } from './components/StageVisualizer'
import { TrackList } from './components/TrackList'
import { TransportBar } from './components/TransportBar'
import { UnsavedChangesModal } from './components/UnsavedChangesModal'
import { dispatchKeyboardShortcut, isImeComposing } from './shortcuts'
import { defaultSaveStrategyRegistry, projectStore, useProjectStore } from './store/useProjectStore'
import styles from './App.module.css'

export function App() {
  const viewMode = useProjectStore((s) => s.viewMode)
  const mergedTheme = useProjectStore((s) => s.mergedTheme)
  const statusMessage = useProjectStore((s) => s.statusMessage)
  const clearStatusMessage = useProjectStore((s) => s.clearStatusMessage)

  useEffect(() => {
    void projectStore.getState().initialize()
  }, [])

  useEffect(() => {
    applyPackTheme(mergedTheme)
  }, [mergedTheme])

  useEffect(() => {
    if (!statusMessage) return
    const timer = setTimeout(() => clearStatusMessage(), 2800)
    return () => clearTimeout(timer)
  }, [statusMessage, clearStatusMessage])

  // Flush auto-save or guard unsaved changes before closing window
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      const state = projectStore.getState()
      if (state.viewMode === 'home' || !state.isDirty) return
      const strategy = defaultSaveStrategyRegistry.get(state.settings.saveMode)
      if (strategy.flushesSilentlyOnClose && state.currentFilePath) {
        void state.saveProjectQuietly()
        return
      }
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Global keyboard shortcuts (declarative table in shortcuts.ts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isImeComposing(e)) return
      const target = e.target as HTMLElement | null
      const isTextInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'

      const result = dispatchKeyboardShortcut(
        {
          key: e.key,
          code: e.code,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          isTextInput
        },
        {
          state: projectStore.getState(),
          actions: {
            togglePlayPause,
            requestNewProject,
            getCurrentTick: () => audioEngine.getCurrentTick(),
            seek: (tick) => audioEngine.seek(tick),
            previewNote: (track, pitch, durationSeconds) =>
              audioEngine.previewNote(track, pitch, durationSeconds)
          }
        }
      )
      if (result.preventDefault) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={styles.shell}>
      {viewMode === 'home' ? (
        <HomeView />
      ) : viewMode === 'stage' ? (
        <StageVisualizer />
      ) : (
        <>
          <TransportBar />
          <main className={styles.workspace}>
            <TrackList />
            <PianoRoll />
          </main>
        </>
      )}

      <SettingsModal />
      <UnsavedChangesModal />

      {statusMessage && (
        <div className={styles.toast} data-testid="status-toast">
          {statusMessage}
        </div>
      )}
    </div>
  )
}
