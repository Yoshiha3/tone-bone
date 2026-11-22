import { audioEngine, wavExporter } from './audioContext'
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

export function requestNewProject(): boolean {
  const state = projectStore.getState()
  if (state.isDirty) {
    const ok = window.confirm('未保存の変更があります。破棄して新規プロジェクトを作成しますか？')
    if (!ok) return false
  }
  stopPlayback()
  state.newProject()
  return true
}

export async function exportCurrentProjectWav(): Promise<boolean> {
  const { project, mergedPacks } = projectStore.getState()
  const wavBytes = await wavExporter.export(project, mergedPacks.instruments)
  const fileName = `${sanitizeFileName(project.title)}.wav`
  const result = await defaultPlatform.saveWavFile(fileName, wavBytes)
  return !result.canceled
}
