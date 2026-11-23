import { useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

export function EditorSettingsTab() {
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const setNoteLengthMode = useProjectStore((s) => s.setNoteLengthMode)
  const saveMode = useProjectStore((s) => s.settings.saveMode)
  const setSaveMode = useProjectStore((s) => s.setSaveMode)

  return (
    <div className={styles.body}>
      <div>
        <div className={styles.sectionLabel}>新規ノーツの初期長さ</div>
        <div className={styles.packList} role="radiogroup" aria-label="新規ノーツの長さ">
          <button
            type="button"
            role="radio"
            aria-checked={noteLengthMode === 'last-used'}
            className={`${styles.choiceCard} ${
              noteLengthMode === 'last-used' ? styles.choiceCardSelected : ''
            }`}
            onClick={() => void setNoteLengthMode('last-used')}
            data-testid="note-len-last-used-btn"
          >
            <span
              className={`${styles.checkCircle} ${
                noteLengthMode === 'last-used' ? styles.checkCircleSelected : ''
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <div className={styles.packInfo}>
              <span className={styles.packName}>直前のノーツの長さを引き継ぐ</span>
              <span className={styles.packDesc}>
                直前に入力・伸縮・選択したノーツと同じ長さで配置します。
              </span>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={noteLengthMode === 'grid-step'}
            className={`${styles.choiceCard} ${
              noteLengthMode === 'grid-step' ? styles.choiceCardSelected : ''
            }`}
            onClick={() => void setNoteLengthMode('grid-step')}
            data-testid="note-len-grid-step-btn"
          >
            <span
              className={`${styles.checkCircle} ${
                noteLengthMode === 'grid-step' ? styles.checkCircleSelected : ''
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <div className={styles.packInfo}>
              <span className={styles.packName}>グリッド幅に合わせる</span>
              <span className={styles.packDesc}>
                現在選択中のグリッド分割（1/16, 1/12など）と同じ長さで配置します。
              </span>
            </div>
          </button>
        </div>
      </div>

      <div>
        <div className={styles.sectionLabel}>プロジェクトの保存方式</div>
        <div className={styles.packList} role="radiogroup" aria-label="プロジェクトの保存方式">
          <button
            type="button"
            role="radio"
            aria-checked={saveMode === 'auto'}
            className={`${styles.choiceCard} ${
              saveMode === 'auto' ? styles.choiceCardSelected : ''
            }`}
            onClick={() => void setSaveMode('auto')}
            data-testid="save-mode-auto-btn"
          >
            <span
              className={`${styles.checkCircle} ${
                saveMode === 'auto' ? styles.checkCircleSelected : ''
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <div className={styles.packInfo}>
              <span className={styles.packName}>自動保存（推奨）</span>
              <span className={styles.packDesc}>
                編集後に自動で上書き保存し、ホーム画面へ戻るときも確実に保存します。
              </span>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={saveMode === 'manual'}
            className={`${styles.choiceCard} ${
              saveMode === 'manual' ? styles.choiceCardSelected : ''
            }`}
            onClick={() => void setSaveMode('manual')}
            data-testid="save-mode-manual-btn"
          >
            <span
              className={`${styles.checkCircle} ${
                saveMode === 'manual' ? styles.checkCircleSelected : ''
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <div className={styles.packInfo}>
              <span className={styles.packName}>手動保存</span>
              <span className={styles.packDesc}>
                Cmd/Ctrl+S または「保存」ボタンのみで保存し、未保存のまま離れる際に確認します。
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
