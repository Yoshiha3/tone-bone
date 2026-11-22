import { useState } from 'react'
import { getDisplayOrderedPacks, reorderActivePacksByDisplayIndex } from '@packs/packOrder'
import { useProjectStore } from '../store/useProjectStore'
import styles from './SettingsModal.module.css'

type Tab = 'packs' | 'editor' | 'storage'

export function SettingsModal() {
  const open = useProjectStore((s) => s.settingsOpen)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const availablePacks = useProjectStore((s) => s.availablePacks)
  const activePackIds = useProjectStore((s) => s.settings.activePackIds)
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const workspaceDir = useProjectStore((s) => s.settings.workspaceDir)
  const setActivePackIds = useProjectStore((s) => s.setActivePackIds)
  const setNoteLengthMode = useProjectStore((s) => s.setNoteLengthMode)
  const reloadPacks = useProjectStore((s) => s.reloadPacks)
  const chooseWorkspaceDir = useProjectStore((s) => s.chooseWorkspaceDir)
  const openFolder = useProjectStore((s) => s.openFolder)

  const [tab, setTab] = useState<Tab>('packs')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  if (!open) return null

  const { active: activePacks, inactive: inactivePacks } = getDisplayOrderedPacks(
    availablePacks,
    activePackIds
  )

  const togglePack = (packId: string): void => {
    const isActive = activePackIds.includes(packId)
    if (isActive) {
      if (activePackIds.length <= 1) return
      void setActivePackIds(activePackIds.filter((id) => id !== packId))
    } else {
      // Newly enabled pack goes on top (highest priority = end of merge list)
      void setActivePackIds([...activePackIds, packId])
    }
  }

  const handleDropOnActive = (toDisplayIndex: number): void => {
    if (draggingIndex !== null && draggingIndex !== toDisplayIndex) {
      const next = reorderActivePacksByDisplayIndex(activePackIds, draggingIndex, toDisplayIndex)
      void setActivePackIds(next)
    }
    setDraggingIndex(null)
    setDropTargetIndex(null)
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
            className={`${styles.tabBtn} ${tab === 'editor' ? styles.tabActive : ''}`}
            onClick={() => setTab('editor')}
            data-testid="tab-editor"
          >
            エディタ
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
              上にあるパックほど優先して適用されます。有効なパックはドラッグで並べ替えできます。
            </p>

            <div>
              <div className={styles.sectionLabel}>有効なパック（上が優先）</div>
              <div className={styles.packList} data-testid="active-pack-list">
                {activePacks.map((pack, displayIdx) => {
                  const canDrag = activePacks.length > 1
                  const isDragging = draggingIndex === displayIdx
                  const isDropTarget = dropTargetIndex === displayIdx && draggingIndex !== displayIdx
                  return (
                    <div
                      key={pack.meta.id}
                      draggable={canDrag}
                      onDragStart={(e) => {
                        setDraggingIndex(displayIdx)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', pack.meta.id)
                      }}
                      onDragOver={(e) => {
                        if (!canDrag) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dropTargetIndex !== displayIdx) {
                          setDropTargetIndex(displayIdx)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDropOnActive(displayIdx)
                      }}
                      onDragEnd={() => {
                        setDraggingIndex(null)
                        setDropTargetIndex(null)
                      }}
                      className={[
                        styles.packRow,
                        styles.packRowActive,
                        canDrag ? styles.packRowDraggable : '',
                        isDragging ? styles.packRowDragging : '',
                        isDropTarget ? styles.packRowDropTarget : ''
                      ].join(' ')}
                      data-testid={`pack-item-${pack.meta.id}`}
                    >
                      <div className={styles.packLeft}>
                        <span
                          className={styles.dragHandle}
                          aria-hidden="true"
                          title={canDrag ? 'ドラッグして優先順位を変更' : undefined}
                        >
                          ⋮⋮
                        </span>
                        <div className={styles.packInfo}>
                          <span className={styles.packName}>{pack.meta.name}</span>
                          <span className={styles.packDesc}>{pack.meta.description}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={true}
                        aria-label={`${pack.meta.name} を無効にする`}
                        disabled={activePacks.length <= 1}
                        className={`${styles.switch} ${styles.switchOn}`}
                        onClick={() => togglePack(pack.meta.id)}
                        data-testid={`pack-toggle-${pack.meta.id}`}
                      >
                        <span className={styles.switchThumb} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {inactivePacks.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>未使用のパック</div>
                <div className={styles.packList} data-testid="inactive-pack-list">
                  {inactivePacks.map((pack) => (
                    <div
                      key={pack.meta.id}
                      className={styles.packRow}
                      data-testid={`pack-item-${pack.meta.id}`}
                    >
                      <div className={styles.packLeft}>
                        <div className={styles.packInfo}>
                          <span className={styles.packName}>{pack.meta.name}</span>
                          <span className={styles.packDesc}>{pack.meta.description}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={false}
                        aria-label={`${pack.meta.name} を有効にする`}
                        className={styles.switch}
                        onClick={() => togglePack(pack.meta.id)}
                        data-testid={`pack-toggle-${pack.meta.id}`}
                      >
                        <span className={styles.switchThumb} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.rowActions}>
              <button type="button" onClick={() => void openFolder('packs')}>
                パックフォルダを開く
              </button>
              <button type="button" onClick={() => void reloadPacks()}>
                再読み込み
              </button>
            </div>
          </div>
        ) : tab === 'editor' ? (
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
