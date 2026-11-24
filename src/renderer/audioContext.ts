import { AudioEngine } from '@audio/AudioEngine'
import { createDefaultAudioExporterRegistry } from '@audio/AudioExporterRegistry'
import { createDefaultVoiceRegistry } from '@audio/VoiceRegistry'
import { projectStore } from './store/useProjectStore'

export const voiceRegistry = createDefaultVoiceRegistry()

export const audioEngine = new AudioEngine(
  () => projectStore.getState().project,
  () => projectStore.getState().mergedSounds.instruments,
  voiceRegistry
)

export const audioExporterRegistry = createDefaultAudioExporterRegistry(voiceRegistry)
