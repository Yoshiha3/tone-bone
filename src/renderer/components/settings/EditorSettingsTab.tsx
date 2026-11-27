import { useEffect, useState } from 'react'
import {
  formatNoteDrawKeyLabel,
  isValidNoteDrawKey,
  type NoteInputMode,
  type NoteLengthMode
} from '@core/types'
import { defaultSaveStrategyRegistry, useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

const NOTE_INPUT_MODE_OPTIONS: readonly {
  id: NoteInputMode
  label: string
  description: string
}[] = [
  {
    id: 'click',
    label: 'クリック入力',
    description: '左クリックでノーツを配置し、押したままドラッグして長さを調整します。'
  },
  {
    id: 'key',
    label: 'キー入力（トラックパッド向け）',
    description: '指定キーを押してノーツを配置し、押したままカーソル移動で長さを調整します。'
  }
]

const NOTE_LENGTH_OPTIONS: readonly {
  id: NoteLengthMode
  label: string
  description: string
}[] = [
  {
    id: 'last-used',
    label: '直前のノーツの長さを引き継ぐ',
    description: '直前に入力・伸縮・選択したノーツと同じ長さで配置します。'
  },
  {
    id: 'grid-step',
    label: 'グリッド幅に合わせる',
    description: '現在選択中のグリッド分割（1/16, 1/12など）と同じ長さで配置します。'
  }
]

export function EditorSettingsTab() {
  const noteInputMode = useProjectStore((s) => s.settings.noteInputMode)
  const noteDrawKey = useProjectStore((s) => s.settings.noteDrawKey)
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const saveMode = useProjectStore((s) => s.settings.saveMode)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  const saveStrategies = defaultSaveStrategyRegistry.list()
  const [capturingKey, setCapturingKey] = useState(false)

  useEffect(() => {
    if (!capturingKey) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setCapturingKey(false)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!isValidNoteDrawKey(e.code)) return
      e.preventDefault()
      e.stopPropagation()
      setCapturingKey(false)
      void updateSettings({ noteDrawKey: e.code })
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturingKey, updateSettings])

  return (
    <div className={styles.body}>
      <div>
        <div className={styles.sectionLabel}>ノーツの入力方法</div>
        <div className={styles.packList} role="radiogroup" aria-label="ノーツの入力方法">
          {NOTE_INPUT_MODE_OPTIONS.map((opt) => {
            const selected = noteInputMode === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ''}`}
                onClick={() => {
                  setCapturingKey(false)
                  void updateSettings({ noteInputMode: opt.id })
                }}
                data-testid={`note-input-mode-${opt.id}-btn`}
              >
                <span
                  className={`${styles.checkCircle} ${selected ? styles.checkCircleSelected : ''}`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className={styles.packInfo}>
                  <span className={styles.packName}>{opt.label}</span>
                  <span className={styles.packDesc}>{opt.description}</span>
                </div>
              </button>
            )
          })}
          {noteInputMode === 'key' && (
            <div className={styles.packRow}>
              <div className={styles.packInfo}>
                <span className={styles.packName}>ノーツ配置キー</span>
                <span className={styles.packDesc}>
                  任意の英字キー（A〜Z）を設定できます。日本語入力がオンでも反応します。
                </span>
              </div>
              <button
                type="button"
                className={`${styles.keyCaptureBtn} ${capturingKey ? styles.keyCaptureBtnActive : ''}`}
                onClick={() => setCapturingKey((prev) => !prev)}
                data-testid="note-draw-key-btn"
              >
                {capturingKey
                  ? 'キーを押してください...'
                  : `${formatNoteDrawKeyLabel(noteDrawKey)}（変更）`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className={styles.sectionLabel}>新規ノーツの初期長さ</div>
        <div className={styles.packList} role="radiogroup" aria-label="新規ノーツの長さ">
          {NOTE_LENGTH_OPTIONS.map((opt) => {
            const selected = noteLengthMode === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ''}`}
                onClick={() => void updateSettings({ noteLengthMode: opt.id })}
                data-testid={`note-len-${opt.id}-btn`}
              >
                <span
                  className={`${styles.checkCircle} ${selected ? styles.checkCircleSelected : ''}`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className={styles.packInfo}>
                  <span className={styles.packName}>{opt.label}</span>
                  <span className={styles.packDesc}>{opt.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className={styles.sectionLabel}>プロジェクトの保存方式</div>
        <div className={styles.packList} role="radiogroup" aria-label="プロジェクトの保存方式">
          {saveStrategies.map((strategy) => {
            const selected = saveMode === strategy.id
            return (
              <button
                key={strategy.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ''}`}
                onClick={() => void updateSettings({ saveMode: strategy.id })}
                data-testid={`save-mode-${strategy.id}-btn`}
              >
                <span
                  className={`${styles.checkCircle} ${selected ? styles.checkCircleSelected : ''}`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className={styles.packInfo}>
                  <span className={styles.packName}>{strategy.label}</span>
                  <span className={styles.packDesc}>{strategy.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
