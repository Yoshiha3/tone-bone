import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import styles from './TrackList.module.css'

export function TrackList() {
  const tracks = useProjectStore((s) => s.project.tracks)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const instruments = useProjectStore((s) => s.mergedPacks.instruments)
  const setSelectedTrackId = useProjectStore((s) => s.setSelectedTrackId)
  const addTrack = useProjectStore((s) => s.addTrack)
  const removeTrack = useProjectStore((s) => s.removeTrack)
  const updateTrack = useProjectStore((s) => s.updateTrack)
  const toggleMute = useProjectStore((s) => s.toggleMute)
  const toggleSolo = useProjectStore((s) => s.toggleSolo)

  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

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

  return (
    <aside className={styles.sidebar} data-testid="track-list">
      <div className={styles.header}>
        <span className={styles.heading}>Tracks</span>
        <div className={styles.addButtons}>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => addTrack('synth')}
            data-testid="add-synth-track-btn"
          >
            + Synth
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => addTrack('drum')}
            data-testid="add-drum-track-btn"
          >
            + Drum
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId
          const compatibleInstruments = instruments.filter((i) => i.type === track.type)
          return (
            <div
              key={track.id}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
              onClick={() => setSelectedTrackId(track.id)}
              data-testid={`track-card-${track.id}`}
            >
              <div
                className={styles.colorBar}
                style={{ backgroundColor: `var(--track-color-${track.colorIndex % 6})` }}
              />

              <div className={styles.rowTop}>
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
