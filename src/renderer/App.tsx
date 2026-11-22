import { useEffect } from 'react'
import { applyPackTheme } from '@packs/themeApplier'
import { requestNewProject, togglePlayPause } from './actions'
import { audioEngine } from './audioContext'
import { PianoRoll } from './components/PianoRoll'
import { SettingsModal } from './components/SettingsModal'
import { StageVisualizer } from './components/StageVisualizer'
import { TrackList } from './components/TrackList'
import { TransportBar } from './components/TransportBar'
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
        if (state.settingsOpen) state.setSettingsOpen(false)
        else if (state.viewMode === 'stage') state.setViewMode('edit')
        return
      }

      if (isInput) return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlayPause()
        return
      }

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
        requestNewProject()
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
      {viewMode === 'stage' ? (
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

      {statusMessage && (
        <div className={styles.toast} data-testid="status-toast">
          {statusMessage}
        </div>
      )}
    </div>
  )
}
