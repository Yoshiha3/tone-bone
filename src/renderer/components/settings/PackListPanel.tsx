import { useState } from 'react'
import type { BasePack } from '@core/types'
import { getDisplayOrderedPacks, reorderActivePacksByDisplayIndex } from '@packs/packOrder'
import styles from '../SettingsModal.module.css'

export interface PackListPanelProps {
  packs: readonly BasePack[]
  activePackIds: readonly string[]
  /** Optional pack ID pinned at the lowest base layer (cannot be disabled or reordered) */
  pinnedBaseId?: string
  hint: string
  folderButtonLabel: string
  testIdPrefix: string
  onChangeActiveIds: (ids: string[]) => void
  onOpenFolder: () => void
  onReload: () => void
}

export function PackListPanel({
  packs,
  activePackIds,
  pinnedBaseId,
  hint,
  folderButtonLabel,
  testIdPrefix,
  onChangeActiveIds,
  onOpenFolder,
  onReload
}: PackListPanelProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const { active: activePacks, inactive: inactivePacks } = getDisplayOrderedPacks(
    packs,
    activePackIds
  )

  const movableActiveCount = pinnedBaseId
    ? activePacks.filter((p) => p.meta.id !== pinnedBaseId).length
    : activePacks.length

  const togglePack = (packId: string): void => {
    if (packId === pinnedBaseId) return
    const isActive = activePackIds.includes(packId)
    if (isActive) {
      if (!pinnedBaseId && activePackIds.length <= 1) return
      onChangeActiveIds(activePackIds.filter((id) => id !== packId))
    } else {
      onChangeActiveIds([...activePackIds, packId])
    }
  }

  const handleDropOnActive = (toDisplayIndex: number): void => {
    if (draggingIndex !== null && draggingIndex !== toDisplayIndex) {
      const next = reorderActivePacksByDisplayIndex(
        activePackIds,
        draggingIndex,
        toDisplayIndex,
        pinnedBaseId
      )
      onChangeActiveIds(next)
    }
    setDraggingIndex(null)
    setDropTargetIndex(null)
  }

  return (
    <div className={styles.body}>
      <p className={styles.hint}>{hint}</p>

      <div>
        <div className={styles.sectionLabel}>有効なパック（上が優先）</div>
        <div className={styles.packList} data-testid={`${testIdPrefix}-active-list`}>
          {activePacks.map((pack, displayIdx) => {
            const isPinnedBase = pack.meta.id === pinnedBaseId
            const canDrag = !isPinnedBase && movableActiveCount > 1
            const isDragging = draggingIndex === displayIdx
            const isDropTarget =
              !isPinnedBase && dropTargetIndex === displayIdx && draggingIndex !== displayIdx
            const disableToggle = isPinnedBase || (!pinnedBaseId && activePacks.length <= 1)

            return (
              <div
                key={pack.meta.id}
                draggable={canDrag}
                onDragStart={(e) => {
                  if (!canDrag) return
                  setDraggingIndex(displayIdx)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', pack.meta.id)
                }}
                onDragOver={(e) => {
                  if (!canDrag || isPinnedBase) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dropTargetIndex !== displayIdx) {
                    setDropTargetIndex(displayIdx)
                  }
                }}
                onDrop={(e) => {
                  if (isPinnedBase) return
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
                data-testid={`${testIdPrefix}-item-${pack.meta.id}`}
              >
                <div className={styles.packLeft}>
                  <span
                    className={styles.dragHandle}
                    aria-hidden="true"
                    title={canDrag ? 'ドラッグして優先順位を変更' : undefined}
                  >
                    {isPinnedBase ? '●' : '⋮⋮'}
                  </span>
                  <div className={styles.packInfo}>
                    <div className={styles.packTitleRow}>
                      <span className={styles.packName}>{pack.meta.name}</span>
                      {isPinnedBase && <span className={styles.baseBadge}>標準ベース</span>}
                    </div>
                    <span className={styles.packDesc}>{pack.meta.description}</span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={true}
                  aria-label={`${pack.meta.name} を無効にする`}
                  disabled={disableToggle}
                  className={`${styles.switch} ${styles.switchOn}`}
                  onClick={() => togglePack(pack.meta.id)}
                  data-testid={`${testIdPrefix}-toggle-${pack.meta.id}`}
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
          <div className={styles.packList} data-testid={`${testIdPrefix}-inactive-list`}>
            {inactivePacks.map((pack) => (
              <div
                key={pack.meta.id}
                className={styles.packRow}
                data-testid={`${testIdPrefix}-item-${pack.meta.id}`}
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
                  data-testid={`${testIdPrefix}-toggle-${pack.meta.id}`}
                >
                  <span className={styles.switchThumb} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.rowActions}>
        <button type="button" onClick={onOpenFolder}>
          {folderButtonLabel}
        </button>
        <button type="button" onClick={onReload}>
          再読み込み
        </button>
      </div>
    </div>
  )
}
