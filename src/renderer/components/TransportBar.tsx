import { useState } from 'react'
import { GRID_DIVISIONS, MAX_BARS, type GridDivision } from '@core/types'
import {
  exportCurrentProject,
  requestNewProject,
  requestOpenExternalProject,
  requestReturnToHome,
  stopPlayback,
  togglePlayPause
} from '../actions'
import { useProjectStore } from '../store/useProjectStore'
import { NumericInput } from './NumericInput'
import styles from './TransportBar.module.css'

export function TransportBar() {
  const title = useProjectStore((s) => s.project.title)
  const bpm = useProjectStore((s) => s.project.bpm)
  const bars = useProjectStore((s) => s.project.bars)
  const loopEnabled = useProjectStore((s) => s.project.loopEnabled)
  const gridDivision = useProjectStore((s) => s.gridDivision)
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const isDirty = useProjectStore((s) => s.isDirty)
  const isAutoSaving = useProjectStore((s) => s.isAutoSaving)
  const saveMode = useProjectStore((s) => s.settings.saveMode)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const setBpm = useProjectStore((s) => s.setBpm)
  const setBars = useProjectStore((s) => s.setBars)
  const toggleLoop = useProjectStore((s) => s.toggleLoop)
  const setGridDivision = useProjectStore((s) => s.setGridDivision)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const saveProject = useProjectStore((s) => s.saveProject)
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs)

  const [exporting, setExporting] = useState(false)

  const handleExportWav = async (): Promise<void> => {
    if (exporting) return
    setExporting(true)
    try {
      await exportCurrentProject()
    } finally {
      setExporting(false)
    }
  }

  const saveTooltip =
    saveMode === 'auto' && currentFilePath
      ? '自動保存 ON（Cmd/Ctrl+S で今すぐ保存 / Shift+クリックで別名保存）'
      : '保存 (Cmd/Ctrl+S) / Shift+クリックで別名保存'

  return (
    <header className={styles.bar} data-testid="transport-bar">
      <div className={styles.group}>
        <button
          type="button"
          className={styles.homeBtn}
          onClick={() => void requestReturnToHome()}
          title="ホーム画面へ戻る"
          data-testid="home-btn"
        >
          ← ホーム
        </button>
        <span className={styles.projectTitle} title={title} data-testid="project-title">
          {title}
        </span>
        <div className={styles.divider} />
        <button
          type="button"
          className={styles.playBtn}
          onClick={togglePlayPause}
          data-testid="play-toggle-btn"
          title="再生 / 一時停止 (Space)"
        >
          {isPlaying ? '一時停止' : '再生'}
        </button>
        <button type="button" onClick={stopPlayback} data-testid="stop-btn" title="停止">
          停止
        </button>
        <button
          type="button"
          className={loopEnabled ? styles.activeToggle : undefined}
          onClick={toggleLoop}
          data-testid="loop-toggle-btn"
          title="ループ再生"
        >
          Loop
        </button>
      </div>

      <div className={styles.group}>
        <label className={styles.field}>
          <span>BPM</span>
          <NumericInput
            value={bpm}
            min={40}
            max={300}
            onCommit={setBpm}
            className={styles.bpmInput}
            testId="bpm-input"
          />
        </label>

        <label className={styles.field}>
          <span>小節</span>
          <NumericInput
            value={bars}
            min={1}
            max={MAX_BARS}
            onCommit={setBars}
            className={styles.barsInput}
            testId="bars-input"
          />
        </label>

        <label className={styles.field}>
          <span>グリッド</span>
          <select
            value={gridDivision}
            onChange={(e) => setGridDivision(e.target.value as GridDivision)}
            className={styles.select}
            data-testid="grid-select"
          >
            {GRID_DIVISIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.group}>
        <button
          type="button"
          className={styles.stageBtn}
          onClick={() => setViewMode('stage')}
          data-testid="stage-mode-btn"
        >
          Stage
        </button>
        <div className={styles.divider} />
        <button
          type="button"
          onClick={() => void requestNewProject()}
          title="新規作成 (Cmd/Ctrl+N)"
          data-testid="new-project-btn"
        >
          新規
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={(e) => void (e.shiftKey ? saveProjectAs() : saveProject())}
          title={saveTooltip}
          data-testid="save-btn"
        >
          <span>{isAutoSaving ? '保存中...' : '保存'}</span>
          {isDirty && !isAutoSaving && (
            <span className={styles.dirtyDot} aria-label="未保存の変更あり" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void requestOpenExternalProject()}
          data-testid="open-btn"
        >
          開く
        </button>
        <button
          type="button"
          onClick={() => void handleExportWav()}
          disabled={exporting}
          data-testid="export-wav-btn"
        >
          {exporting ? '書出中...' : 'WAV'}
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} data-testid="settings-btn">
          設定
        </button>
      </div>
    </header>
  )
}
