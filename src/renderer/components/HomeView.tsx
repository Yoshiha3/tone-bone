import { useRef, useState } from 'react'
import { requestNewProject, requestOpenExternalProject } from '../actions'
import { isImeComposing } from '../shortcuts'
import { useProjectStore } from '../store/useProjectStore'
import styles from './HomeView.module.css'

function formatUpdatedAt(timestampMs: number): string {
  const d = new Date(timestampMs)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`
}

export function HomeView() {
  const projects = useProjectStore((s) => s.workspaceProjects)
  const selectedPath = useProjectStore((s) => s.selectedHomeProjectPath)
  const workspaceDir = useProjectStore((s) => s.settings.workspaceDir)
  const setSelectedPath = useProjectStore((s) => s.setSelectedHomeProjectPath)
  const openWorkspaceProject = useProjectStore((s) => s.openWorkspaceProject)
  const createWorkspaceProject = useProjectStore((s) => s.createWorkspaceProject)
  const renameWorkspaceProject = useProjectStore((s) => s.renameWorkspaceProject)
  const duplicateWorkspaceProject = useProjectStore((s) => s.duplicateWorkspaceProject)
  const deleteWorkspaceProject = useProjectStore((s) => s.deleteWorkspaceProject)
  const openFolder = useProjectStore((s) => s.openFolder)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const renameSettledRef = useRef(false)

  const startRename = (filePath: string, currentTitle: string): void => {
    renameSettledRef.current = false
    setSelectedPath(filePath)
    setRenamingPath(filePath)
    setDraftTitle(currentTitle)
  }

  const commitRename = async (filePath: string, currentTitle: string): Promise<void> => {
    if (renameSettledRef.current) return
    renameSettledRef.current = true
    const trimmed = draftTitle.trim()
    setRenamingPath(null)
    if (!trimmed || trimmed === currentTitle) return
    await renameWorkspaceProject(filePath, trimmed)
  }

  const cancelRename = (): void => {
    renameSettledRef.current = true
    setRenamingPath(null)
  }

  const handleDelete = async (filePath: string, title: string): Promise<void> => {
    const ok = window.confirm(`「${title}」をゴミ箱へ移動しますか？`)
    if (!ok) return
    await deleteWorkspaceProject(filePath)
  }

  return (
    <div className={styles.page} data-testid="home-view">
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brand}>Onkai</span>
          <span className={styles.subtitle}>Projects</span>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void requestNewProject()}
            data-testid="home-new-project-btn"
          >
            + 新規作成
          </button>
          <button
            type="button"
            onClick={() => void createWorkspaceProject('demo', { openImmediately: false })}
            data-testid="home-add-demo-btn"
          >
            デモ曲を追加
          </button>
          <button
            type="button"
            onClick={() => void requestOpenExternalProject()}
            data-testid="home-open-external-btn"
          >
            外部ファイルを開く
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} data-testid="settings-btn">
            設定
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {projects.length === 0 ? (
          <section className={styles.emptyState} data-testid="home-empty-state">
            <h1 className={styles.emptyTitle}>プロジェクトがまだありません</h1>
            <p className={styles.emptyDesc}>
              新しい曲を作成するか、デモ曲を追加して Onkai を始めましょう。
            </p>
            <div className={styles.emptyActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void requestNewProject()}
                data-testid="empty-new-project-btn"
              >
                + 新規プロジェクトを作成
              </button>
              <button
                type="button"
                onClick={() => void createWorkspaceProject('demo', { openImmediately: false })}
                data-testid="empty-add-demo-btn"
              >
                デモ曲を追加
              </button>
              <button type="button" onClick={() => void requestOpenExternalProject()}>
                外部ファイルを開く
              </button>
            </div>
            {workspaceDir && <p className={styles.emptyPath}>{workspaceDir}/projects</p>}
          </section>
        ) : (
          <section className={styles.listSection}>
            <div className={styles.listHeader}>
              <div className={styles.listMeta}>
                <h1 className={styles.listHeading}>プロジェクト一覧（{projects.length}）</h1>
                <span className={styles.listHint}>ダブルクリックまたは Enter で編集を開く</span>
              </div>
              <button
                type="button"
                className={styles.subtleBtn}
                onClick={() => void openFolder('projects')}
                data-testid="home-open-folder-btn"
              >
                フォルダを開く
              </button>
            </div>

            <div className={styles.grid} data-testid="home-project-grid">
              {projects.map((item, idx) => {
                const isSelected = item.filePath === selectedPath
                const isRenaming = item.filePath === renamingPath
                return (
                  <div
                    key={item.filePath}
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                    onClick={() => setSelectedPath(item.filePath)}
                    onDoubleClick={() => {
                      if (!isRenaming) void openWorkspaceProject(item.filePath)
                    }}
                    data-testid={`project-card-${idx}`}
                    data-project-title={item.title}
                  >
                    <div className={styles.cardTop}>
                      {isRenaming ? (
                        <input
                          type="text"
                          className={styles.renameInput}
                          value={draftTitle}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={() => void commitRename(item.filePath, item.title)}
                          onKeyDown={(e) => {
                            if (isImeComposing(e)) return
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              void commitRename(item.filePath, item.title)
                            } else if (e.key === 'Escape') {
                              e.stopPropagation()
                              cancelRename()
                            }
                          }}
                          aria-label="プロジェクト名を変更"
                          data-testid={`project-rename-input-${idx}`}
                        />
                      ) : (
                        <span className={styles.cardTitle} title={item.title}>
                          {item.title}
                        </span>
                      )}
                      <span className={styles.cardFileName} title={item.fileName}>
                        {item.fileName}
                      </span>
                    </div>

                    <div className={styles.cardStats}>
                      <span>{item.bpm} BPM</span>
                      <span>·</span>
                      <span>{item.bars} 小節</span>
                      <span>·</span>
                      <span>{item.trackCount} トラック</span>
                    </div>

                    <div className={styles.updatedAt}>
                      更新: {formatUpdatedAt(item.updatedAtMs)}
                    </div>

                    <div
                      className={styles.cardFooter}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => void openWorkspaceProject(item.filePath)}
                        data-testid={`project-edit-btn-${idx}`}
                      >
                        編集
                      </button>
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => startRename(item.filePath, item.title)}
                          data-testid={`project-rename-btn-${idx}`}
                        >
                          名前変更
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => void duplicateWorkspaceProject(item.filePath)}
                          data-testid={`project-duplicate-btn-${idx}`}
                        >
                          複製
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => void handleDelete(item.filePath, item.title)}
                          data-testid={`project-delete-btn-${idx}`}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
