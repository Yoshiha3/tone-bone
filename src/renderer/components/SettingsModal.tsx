import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import styles from './SettingsModal.module.css'

type Tab = 'packs' | 'storage'

export function SettingsModal() {
  const open = useProjectStore((s) => s.settingsOpen)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const availablePacks = useProjectStore((s) => s.availablePacks)
  const activePackIds = useProjectStore((s) => s.settings.activePackIds)
  const workspaceDir = useProjectStore((s) => s.settings.workspaceDir)
  const setActivePackIds = useProjectStore((s) => s.setActivePackIds)
  const reloadPacks = useProjectStore((s) => s.reloadPacks)
  const chooseWorkspaceDir = useProjectStore((s) => s.chooseWorkspaceDir)
  const openFolder = useProjectStore((s) => s.openFolder)

  const [tab, setTab] = useState<Tab>('packs')

  if (!open) return null

  const togglePack = (packId: string): void => {
    const isActive = activePackIds.includes(packId)
    if (isActive) {
      if (activePackIds.length <= 1) return
      void setActivePackIds(activePackIds.filter((id) => id !== packId))
    } else {
      void setActivePackIds([...activePackIds, packId])
    }
  }

  const movePack = (packId: string, dir: -1 | 1): void => {
    const idx = activePackIds.indexOf(packId)
    if (idx < 0) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= activePackIds.length) return
    const copy = [...activePackIds]
    const [item] = copy.splice(idx, 1)
    copy.splice(nextIdx, 0, item)
    void setActivePackIds(copy)
  }

  return (
    <div
      className={styles.backdrop}
      onClick={() => setSettingsOpen(false)}
      data-testid="settings-modal"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>設定</span>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            data-testid="settings-close-btn"
          >
            閉じる
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'packs' ? styles.tabActive : ''}`}
            onClick={() => setTab('packs')}
            data-testid="tab-packs"
          >
            リソースパック
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'storage' ? styles.tabActive : ''}`}
            onClick={() => setTab('storage')}
            data-testid="tab-storage"
          >
            保存先フォルダ
          </button>
        </div>

        {tab === 'packs' ? (
          <div className={styles.body}>
            <p className={styles.hint}>
              有効なパックは番号が大きいほど優先して上書き適用されます。
            </p>
            <div className={styles.packList}>
              {availablePacks.map((pack) => {
                const orderIdx = activePackIds.indexOf(pack.meta.id)
                const isActive = orderIdx >= 0
                return (
                  <div
                    key={pack.meta.id}
                    className={`${styles.packRow} ${isActive ? styles.packRowActive : ''}`}
                    data-testid={`pack-item-${pack.meta.id}`}
                  >
                    <div className={styles.packInfo}>
                      <span className={styles.packName}>
                        {pack.meta.name} {isActive ? `(#${orderIdx + 1})` : ''}
                      </span>
                      <span className={styles.packDesc}>{pack.meta.description}</span>
                    </div>
                    <div className={styles.packActions}>
                      {isActive && activePackIds.length > 1 && (
                        <>
                          <button
                            type="button"
                            disabled={orderIdx === 0}
                            onClick={() => movePack(pack.meta.id, -1)}
                            title="優先度を下げる"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={orderIdx === activePackIds.length - 1}
                            onClick={() => movePack(pack.meta.id, 1)}
                            title="優先度を上げる"
                          >
                            ↑
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePack(pack.meta.id)}
                        data-testid={`pack-toggle-${pack.meta.id}`}
                      >
                        {isActive ? '有効' : '適用'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={styles.rowActions}>
              <button type="button" onClick={() => void openFolder('packs')}>
                パックフォルダを開く
              </button>
              <button type="button" onClick={() => void reloadPacks()}>
                再読み込み
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.hint}>
              曲ファイル（projects/）、書き出しWAV（exports/）、追加パック（packs/）の保存場所です。
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
        )}
      </div>
    </div>
  )
}
