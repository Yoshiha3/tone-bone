import { useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

export function StorageSettingsTab() {
  const workspaceDir = useProjectStore((s) => s.settings.workspaceDir)
  const chooseWorkspaceDir = useProjectStore((s) => s.chooseWorkspaceDir)
  const openFolder = useProjectStore((s) => s.openFolder)

  return (
    <div className={styles.body}>
      <p className={styles.hint}>
        曲ファイル（projects/）、書き出しWAV（exports/）、追加テーマ（themes/）、追加音源（sounds/）の保存場所です。
      </p>
      <div className={styles.pathBox} data-testid="workspace-path">
        {workspaceDir || '(未設定)'}
      </div>
      <div className={styles.rowActions}>
        <button type="button" onClick={() => void chooseWorkspaceDir()}>
          保存先フォルダを変更
        </button>
        <button type="button" onClick={() => void openFolder('workspace')}>
          フォルダを開く
        </button>
      </div>
    </div>
  )
}
