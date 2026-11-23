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
import { projectStore, useProjectStore } from './store/useProjectStore'
import styles from './App.module.css'

export function App() {
  const viewMode = useProjectStore((s) => s.viewMode)
  const mergedPacks = useProjectStore((s) => s.mergedPacks)
  const statusMessage = useProjectStore((s) => s.statusMessage)
  const clearStatusMessage = useProjectStore((s) => s.clearStatusMessage)

  useEffect(() => {
    void projectStore.getState().initialize()
  }, [])

  useEffect(() => {
    applyPackTheme(mergedPacks)
  }, [mergedPacks])

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
      if (state.settings.saveMode === 'auto' && state.currentFilePath) {
        void state.saveProjectQuietly()
        return
      }
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Global keyboard shortcuts (cross-platform Cmd/Ctrl)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'

      const state = projectStore.getState()
      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        if (state.unsavedPrompt) state.resolveLeaveDecision('cancel')
        else if (state.settingsOpen) state.setSettingsOpen(false)
        else if (state.viewMode === 'stage') state.setViewMode('edit')
        return
      }

      if (isInput || state.settingsOpen || state.unsavedPrompt) return

      if (state.viewMode === 'home') {
        if (mod && e.key.toLowerCase() === 'n') {
          e.preventDefault()
          void requestNewProject()
          return
        }
        if (e.key === 'Enter' && state.selectedHomeProjectPath) {
          e.preventDefault()
          void state.openWorkspaceProject(state.selectedHomeProjectPath)
        }
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlayPause()
        return
      }

      if (state.viewMode !== 'edit') return

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        state.copySelectedNotes()
        return
      }

      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        state.pasteNotes(Math.round(audioEngine.getCurrentTick()))
        return
      }

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void requestNewProject()
        return
      }

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (e.shiftKey) void state.saveProjectAs()
        else void state.saveProject()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        state.deleteSelectedNotes()
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
