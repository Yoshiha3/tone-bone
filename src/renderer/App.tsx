import { useEffect } from 'react'
import { applyPackTheme } from '@packs/themeApplier'
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

  // Initialize settings and resource packs on startup
  useEffect(() => {
    void projectStore.getState().initialize()
  }, [])

  // Apply merged resource pack CSS tokens & optional override CSS whenever packs change
  useEffect(() => {
    applyPackTheme(mergedPacks)
  }, [mergedPacks])

  // Auto-clear brief status toast
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
        if (state.settingsOpen) {
          state.setSettingsOpen(false)
        } else if (state.viewMode === 'stage') {
          state.setViewMode('edit')
        }
        return
      }

      if (isInput) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (audioEngine.getIsPlaying()) {
          audioEngine.pause()
          state.setIsPlaying(false)
        } else {
          audioEngine.play()
          state.setIsPlaying(true)
        }
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
        if (state.isDirty) {
          const ok = window.confirm('未保存の変更があります。破棄して新規プロジェクトを作成しますか？')
          if (!ok) return
        }
        audioEngine.stop()
        state.setIsPlaying(false)
        state.newProject()
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
