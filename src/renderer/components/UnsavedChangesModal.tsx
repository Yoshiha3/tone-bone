import { useProjectStore } from '../store/useProjectStore'
import styles from './UnsavedChangesModal.module.css'

export function UnsavedChangesModal() {
  const prompt = useProjectStore((s) => s.unsavedPrompt)
  const resolveLeaveDecision = useProjectStore((s) => s.resolveLeaveDecision)

  if (!prompt) return null

  return (
    <div
      className={styles.backdrop}
      onClick={() => resolveLeaveDecision('cancel')}
      data-testid="unsaved-modal"
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="unsaved-modal-title" className={styles.title}>
          未保存の変更があります
        </h2>
        <p className={styles.message}>{prompt.message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => resolveLeaveDecision('cancel')}
            data-testid="unsaved-cancel-btn"
          >
            キャンセル
          </button>
          <div className={styles.rightActions}>
            <button
              type="button"
              className={styles.discardBtn}
              onClick={() => resolveLeaveDecision('discard')}
              data-testid="unsaved-discard-btn"
            >
              {prompt.discardLabel}
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => resolveLeaveDecision('save')}
              data-testid="unsaved-save-btn"
            >
              {prompt.saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
