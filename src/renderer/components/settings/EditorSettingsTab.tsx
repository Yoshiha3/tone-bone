import { useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

export function EditorSettingsTab() {
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const setNoteLengthMode = useProjectStore((s) => s.setNoteLengthMode)

  return (
    <div className={styles.body}>
      <p className={styles.hint}>ピアノロールで新しくノーツを配置するときの初期長さ</p>
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
  )
}
