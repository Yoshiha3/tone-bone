import { AudioEngine } from '@audio/AudioEngine'
import { WavExporter } from '@audio/exporters/WavExporter'
import { projectStore } from './store/useProjectStore'

export const audioEngine = new AudioEngine(
  () => projectStore.getState().project,
  () => projectStore.getState().mergedSounds.instruments
)

export const wavExporter = new WavExporter()
