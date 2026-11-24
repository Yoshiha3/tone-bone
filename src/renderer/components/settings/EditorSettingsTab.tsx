import type { NoteLengthMode } from '@core/types'
import { defaultSaveStrategyRegistry, useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

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
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const saveMode = useProjectStore((s) => s.settings.saveMode)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  const saveStrategies = defaultSaveStrategyRegistry.list()

  return (
    <div className={styles.body}>
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
