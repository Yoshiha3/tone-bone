import { useState } from 'react'
import { getDisplayOrderedPacks, reorderActivePacksByDisplayIndex } from '@packs/packOrder'
import { useProjectStore } from '../../store/useProjectStore'
import styles from '../SettingsModal.module.css'

export function PacksSettingsTab() {
  const availablePacks = useProjectStore((s) => s.availablePacks)
  const activePackIds = useProjectStore((s) => s.settings.activePackIds)
  const setActivePackIds = useProjectStore((s) => s.setActivePackIds)
  const reloadPacks = useProjectStore((s) => s.reloadPacks)
  const openFolder = useProjectStore((s) => s.openFolder)

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

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
  )
}
