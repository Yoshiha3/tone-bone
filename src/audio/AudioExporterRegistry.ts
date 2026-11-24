import { WavExporter } from './exporters/WavExporter'
import type { AudioExporter } from './types'
import { createDefaultVoiceRegistry, type VoiceRegistry } from './VoiceRegistry'

/**
 * Pluggable audio export format registry.
 * Additional exporters (MP3, OGG, MIDI, etc.) can be registered without
 * modifying actions, PlatformAdapter, or Electron Main IPC handlers.
 */
export class AudioExporterRegistry {
  private readonly exporters = new Map<string, AudioExporter>()
  private defaultId: string | null = null

  register(exporter: AudioExporter, setAsDefault = false): void {
    this.exporters.set(exporter.id, exporter)
    if (setAsDefault || this.defaultId === null) {
      this.defaultId = exporter.id
    }
  }

  getById(id: string): AudioExporter | undefined {
    return this.exporters.get(id)
  }

  getDefault(): AudioExporter {
    if (!this.defaultId) {
      throw new Error('No audio exporter registered')
    }
    const exporter = this.exporters.get(this.defaultId)
    if (!exporter) {
      throw new Error(`Default audio exporter not found: ${this.defaultId}`)
    }
    return exporter
  }

  get(id: string): AudioExporter {
    const found = this.exporters.get(id)
    if (found) return found
    return this.getDefault()
  }

  list(): AudioExporter[] {
    return Array.from(this.exporters.values())
  }
}

export function createDefaultAudioExporterRegistry(
  voiceRegistry: VoiceRegistry = createDefaultVoiceRegistry()
): AudioExporterRegistry {
  const registry = new AudioExporterRegistry()
  registry.register(new WavExporter(voiceRegistry), true)
  return registry
}
