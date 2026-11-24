import type { TrackType } from '@core/types'
import type { AudioVoice } from './types'
import { DrumVoice } from './voices/DrumVoice'
import { SynthVoice } from './voices/SynthVoice'

/**
 * Pluggable audio voice registry shared by real-time playback (AudioEngine)
 * and offline rendering (exporters).
 */
export class VoiceRegistry {
  private readonly voices = new Map<TrackType, AudioVoice>()
  private defaultType: TrackType | null = null

  register(voice: AudioVoice, setAsDefault = false): void {
    this.voices.set(voice.type, voice)
    if (setAsDefault || this.defaultType === null) {
      this.defaultType = voice.type
    }
  }

  has(type: TrackType): boolean {
    return this.voices.has(type)
  }

  get(type: TrackType): AudioVoice {
    const found = this.voices.get(type)
    if (found) return found
    if (this.defaultType) {
      const fallback = this.voices.get(this.defaultType)
      if (fallback) return fallback
    }
    throw new Error(`No audio voice registered for track type: ${type}`)
  }

  list(): AudioVoice[] {
    return Array.from(this.voices.values())
  }
}

export function createDefaultVoiceRegistry(): VoiceRegistry {
  const registry = new VoiceRegistry()
  registry.register(new SynthVoice(), true)
  registry.register(new DrumVoice())
  return registry
}
