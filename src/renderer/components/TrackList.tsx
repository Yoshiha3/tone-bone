import { useState } from 'react'
import { TRACK_TYPES } from '@core/trackTypes'
import { useProjectStore } from '../store/useProjectStore'
import styles from './TrackList.module.css'

export function TrackList() {
  const tracks = useProjectStore((s) => s.project.tracks)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const instruments = useProjectStore((s) => s.mergedSounds.instruments)
  const setSelectedTrackId = useProjectStore((s) => s.setSelectedTrackId)
  const addTrack = useProjectStore((s) => s.addTrack)
  const removeTrack = useProjectStore((s) => s.removeTrack)
  const reorderTracks = useProjectStore((s) => s.reorderTracks)
  const updateTrack = useProjectStore((s) => s.updateTrack)
  const toggleMute = useProjectStore((s) => s.toggleMute)
  const toggleSolo = useProjectStore((s) => s.toggleSolo)

  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const canReorder = tracks.length > 1

  const startRename = (trackId: string, currentName: string): void => {
    setEditingTrackId(trackId)
    setDraftName(currentName)
  }

  const commitRename = (trackId: string): void => {
    const trimmed = draftName.trim()
    if (trimmed.length > 0) {
      updateTrack(trackId, { name: trimmed })
    }
    setEditingTrackId(null)
  }

  const clearDragState = (): void => {
    setDraggingIndex(null)
    setDropTargetIndex(null)
  }

  const handleDropOnTrack = (targetIndex: number): void => {
    if (draggingIndex !== null && draggingIndex !== targetIndex) {
      reorderTracks(draggingIndex, targetIndex)
    }
    clearDragState()
  }

  return (
    <aside className={styles.sidebar} data-testid="track-list">
      <div className={styles.header}>
        <span className={styles.heading}>Tracks</span>
        <div className={styles.addButtons}>
          {TRACK_TYPES.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className={styles.smallBtn}
              onClick={() => addTrack(spec.type)}
              data-testid={`add-${spec.type}-track-btn`}
            >
              {spec.addButtonLabel}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {tracks.map((track, idx) => {
          const isSelected = track.id === selectedTrackId
          const compatibleInstruments = instruments.filter((i) => i.type === track.type)
          const isDragging = draggingIndex === idx
          const isDropAbove =
            draggingIndex !== null && dropTargetIndex === idx && draggingIndex > idx
          const isDropBelow =
            draggingIndex !== null && dropTargetIndex === idx && draggingIndex < idx

          return (
            <div
              key={track.id}
              className={[
                styles.card,
                isSelected ? styles.cardSelected : '',
                isDragging ? styles.cardDragging : '',
                isDropAbove ? styles.cardDropAbove : '',
                isDropBelow ? styles.cardDropBelow : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedTrackId(track.id)}
              onDragOver={(e) => {
                if (draggingIndex === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dropTargetIndex !== idx) {
                  setDropTargetIndex(idx)
                }
              }}
              onDrop={(e) => {
                if (draggingIndex === null) return
                e.preventDefault()
                handleDropOnTrack(idx)
              }}
              data-track-card="true"
              data-testid={`track-card-${track.id}`}
            >
              <div
                className={styles.colorBar}
                style={{ backgroundColor: `var(--track-color-${track.colorIndex % 6})` }}
              />

              <div className={styles.rowTop}>
                {canReorder && (
                  <span
                    className={styles.dragHandle}
                    draggable
                    title="ドラッグして並べ替え"
                    aria-label={`${track.name} を並べ替え`}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      setDraggingIndex(idx)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', track.id)
                      const cardEl = e.currentTarget.closest('[data-track-card]')
                      if (cardEl && typeof e.dataTransfer.setDragImage === 'function') {
                        e.dataTransfer.setDragImage(cardEl, 18, 18)
                      }
                    }}
                    onDragEnd={clearDragState}
                    data-testid={`track-drag-handle-${track.id}`}
                  >
                    ⋮⋮
                  </span>
                )}
                {editingTrackId === track.id ? (
                  <input
                    type="text"
                    className={styles.trackNameInput}
                    value={draftName}
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(track.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitRename(track.id)
                      } else if (e.key === 'Escape') {
                        setEditingTrackId(null)
                      }
                    }}
                    data-testid={`track-name-input-${track.id}`}
                  />
                ) : (
                  <span
                    className={styles.trackName}
                    title="ダブルクリックで名前を変更"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startRename(track.id, track.name)
                    }}
                    data-testid={`track-name-${track.id}`}
                  >
                    {track.name}
                  </span>
                )}
                {tracks.length > 1 && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    title="トラックを削除"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTrack(track.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                className={styles.instrumentSelect}
                value={track.instrumentId}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateTrack(track.id, { instrumentId: e.target.value })}
                aria-label={`${track.name} 音色`}
              >
                {compatibleInstruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>

              <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${track.muted ? styles.mutedActive : ''}`}
                  onClick={() => toggleMute(track.id)}
                  data-testid={`mute-btn-${track.id}`}
                  title="ミュート"
                >
                  M
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${track.solo ? styles.soloActive : ''}`}
                  onClick={() => toggleSolo(track.id)}
                  data-testid={`solo-btn-${track.id}`}
                  title="ソロ"
                >
                  S
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={track.volume}
                  onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
                  className={styles.volumeSlider}
                  title={`音量: ${Math.round(track.volume * 100)}%`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
