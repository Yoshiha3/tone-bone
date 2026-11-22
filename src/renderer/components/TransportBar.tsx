import { useEffect, useState } from 'react'
import { clamp } from '@core/musicMath'
import { GRID_DIVISIONS, type GridDivision } from '@core/types'
import { audioEngine, wavExporter } from '../audioContext'
import { defaultPlatform, useProjectStore } from '../store/useProjectStore'
import styles from './TransportBar.module.css'

export function TransportBar() {
  const bpm = useProjectStore((s) => s.project.bpm)
  const bars = useProjectStore((s) => s.project.bars)
  const title = useProjectStore((s) => s.project.title)
  const loopEnabled = useProjectStore((s) => s.project.loopEnabled)
  const gridDivision = useProjectStore((s) => s.gridDivision)
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying)
  const setBpm = useProjectStore((s) => s.setBpm)
  const setBars = useProjectStore((s) => s.setBars)
  const toggleLoop = useProjectStore((s) => s.toggleLoop)
  const setGridDivision = useProjectStore((s) => s.setGridDivision)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const saveProject = useProjectStore((s) => s.saveProject)
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs)
  const openProject = useProjectStore((s) => s.openProject)
  const newProject = useProjectStore((s) => s.newProject)
  const isDirty = useProjectStore((s) => s.isDirty)
  const project = useProjectStore((s) => s.project)
  const instruments = useProjectStore((s) => s.mergedPacks.instruments)

  const [exporting, setExporting] = useState(false)
  const [bpmText, setBpmText] = useState(String(bpm))

  useEffect(() => {
    setBpmText(String(bpm))
  }, [bpm])

  const commitBpm = (): void => {
    const trimmed = bpmText.trim()
    const parsed = Number(trimmed)
    if (trimmed.length === 0 || !Number.isFinite(parsed)) {
      setBpmText(String(bpm))
      return
    }
    const next = clamp(Math.round(parsed), 40, 300)
    if (next !== bpm) {
      setBpm(next)
    }
    setBpmText(String(next))
  }

  const handleTogglePlay = (): void => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.pause()
      setIsPlaying(false)
    } else {
      audioEngine.play()
      setIsPlaying(true)
    }
  }

  const handleStop = (): void => {
    audioEngine.stop()
    setIsPlaying(false)
  }

  const handleNewProject = (): void => {
    if (isDirty) {
      const ok = window.confirm('未保存の変更があります。破棄して新規プロジェクトを作成しますか？')
      if (!ok) return
    }
    audioEngine.stop()
    setIsPlaying(false)
    newProject()
  }

  const handleExportWav = async (): Promise<void> => {
    if (exporting) return
    setExporting(true)
    try {
      const wavBytes = await wavExporter.export(project, instruments)
      const safeName = (title.trim() || 'untitled').replace(/[\\/:*?"<>|]/g, '_')
      await defaultPlatform.saveWavFile(`${safeName}.wav`, wavBytes)
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className={styles.bar} data-testid="transport-bar">
      <div className={styles.group}>
        <span className={styles.brand}>Tone Bone</span>
        <button
          type="button"
          className={styles.playBtn}
          onClick={handleTogglePlay}
          data-testid="play-toggle-btn"
          title="再生 / 一時停止 (Space)"
        >
          {isPlaying ? '一時停止' : '再生'}
        </button>
        <button type="button" onClick={handleStop} data-testid="stop-btn" title="停止">
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
          <input
            type="text"
            inputMode="numeric"
            value={bpmText}
            onChange={(e) => setBpmText(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitBpm()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setBpmText(String(bpm))
                e.currentTarget.blur()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setBpm(bpm + 1)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setBpm(bpm - 1)
              }
            }}
            className={styles.bpmInput}
            data-testid="bpm-input"
          />
        </label>

        <label className={styles.field}>
          <span>小節</span>
          <select
            value={bars}
            onChange={(e) => setBars(Number(e.target.value))}
            className={styles.select}
            data-testid="bars-select"
          >
            {[2, 4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
          onClick={handleNewProject}
          title="新規作成 (Cmd/Ctrl+N)"
          data-testid="new-project-btn"
        >
          新規
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={(e) => void (e.shiftKey ? saveProjectAs() : saveProject())}
          title="保存 (Cmd/Ctrl+S) / Shift+クリックで別名保存"
          data-testid="save-btn"
        >
          <span>保存</span>
          {isDirty && <span className={styles.dirtyDot} aria-label="未保存の変更あり" />}
        </button>
        <button type="button" onClick={() => void openProject()} data-testid="open-btn">
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
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          data-testid="settings-btn"
        >
          設定
        </button>
      </div>
    </header>
  )
}
