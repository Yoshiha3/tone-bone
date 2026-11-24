import { audioEngine, audioExporterRegistry } from './audioContext'
import { defaultPlatform, projectStore } from './store/useProjectStore'

export function sanitizeFileName(rawTitle: string): string {
  return (rawTitle.trim() || 'untitled').replace(/[\\/:*?"<>|]/g, '_')
}

export function togglePlayPause(): void {
  const state = projectStore.getState()
  if (audioEngine.getIsPlaying()) {
    audioEngine.pause()
    state.setIsPlaying(false)
  } else {
    audioEngine.play()
    state.setIsPlaying(true)
  }
}

export function stopPlayback(): void {
  audioEngine.stop()
  projectStore.getState().setIsPlaying(false)
}

export async function requestReturnToHome(): Promise<boolean> {
  stopPlayback()
  const state = projectStore.getState()
  return state.returnToHome(() =>
    state.requestLeaveDecision({
      message: `「${state.project.title}」に未保存の変更があります。ホーム画面へ戻る前に保存しますか？`,
      saveLabel: '保存して戻る',
      discardLabel: '保存せず戻る'
    })
  )
}

export async function requestNewProject(): Promise<boolean> {
  const state = projectStore.getState()
  if (state.viewMode !== 'home') {
    const canLeave = await state.prepareLeaveCurrentProject(() =>
      state.requestLeaveDecision({
        message: `「${state.project.title}」に未保存の変更があります。新規プロジェクトを作成する前に保存しますか？`,
        saveLabel: '保存して作成',
        discardLabel: '保存せず作成'
      })
    )
    if (!canLeave) return false
  }
  stopPlayback()
  const created = await state.createWorkspaceProject('empty', { openImmediately: true })
  return created !== null
}

export async function requestOpenExternalProject(): Promise<boolean> {
  const state = projectStore.getState()
  if (state.viewMode !== 'home') {
    const canLeave = await state.prepareLeaveCurrentProject(() =>
      state.requestLeaveDecision({
        message: `「${state.project.title}」に未保存の変更があります。別のプロジェクトを開く前に保存しますか？`,
        saveLabel: '保存して開く',
        discardLabel: '保存せず開く'
      })
    )
    if (!canLeave) return false
  }
  stopPlayback()
  return state.openProject()
}

export async function exportCurrentProject(exporterId?: string): Promise<boolean> {
  const { project, mergedSounds } = projectStore.getState()
  const exporter = exporterId
    ? audioExporterRegistry.get(exporterId)
    : audioExporterRegistry.getDefault()
  const bytes = await exporter.export(project, mergedSounds.instruments)
  const fileName = `${sanitizeFileName(project.title)}.${exporter.extension}`
  const result = await defaultPlatform.saveExportFile({
    suggestedName: fileName,
    filterName: exporter.label,
    extension: exporter.extension,
    data: bytes
  })
  return !result.canceled
}

export async function exportCurrentProjectWav(): Promise<boolean> {
  return exportCurrentProject('wav-pcm16')
}
