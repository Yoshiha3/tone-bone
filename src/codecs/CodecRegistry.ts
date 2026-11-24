import type { Project } from '@core/types'
import { SimpleJsonV1Codec } from './SimpleJsonV1Codec'
import type { ProjectCodec } from './types'

export class CodecRegistry {
  private readonly codecs = new Map<string, ProjectCodec>()
  private defaultCodecId: string | null = null

  register(codec: ProjectCodec, setAsDefault = false): void {
    this.codecs.set(codec.id, codec)
    if (setAsDefault || this.defaultCodecId === null) {
      this.defaultCodecId = codec.id
    }
  }

  getById(id: string): ProjectCodec | undefined {
    return this.codecs.get(id)
  }

  getDefault(): ProjectCodec {
    if (!this.defaultCodecId) {
      throw new Error('No project codec registered')
    }
    const codec = this.codecs.get(this.defaultCodecId)
    if (!codec) {
      throw new Error(`Default codec not found: ${this.defaultCodecId}`)
    }
    return codec
  }

  list(): ProjectCodec[] {
    return Array.from(this.codecs.values())
  }

  getDefaultExtension(): string {
    const ext = this.getDefault().extensions[0]
    if (!ext) {
      throw new Error(`Default codec has no extensions: ${this.getDefault().id}`)
    }
    return ext.replace(/^\./, '').toLowerCase()
  }

  getAllExtensions(): string[] {
    const seen = new Set<string>()
    for (const codec of this.codecs.values()) {
      for (const ext of codec.extensions) {
        const normalized = ext.replace(/^\./, '').toLowerCase()
        if (normalized) seen.add(normalized)
      }
    }
    return Array.from(seen)
  }

  getFileFilters(): { name: string; extensions: string[] }[] {
    const codecs = this.list()
    const perCodec = codecs.map((codec) => ({
      name: codec.label,
      extensions: codec.extensions.map((ext) => ext.replace(/^\./, '').toLowerCase())
    }))
    if (perCodec.length <= 1) return perCodec
    return [{ name: 'All Supported Projects', extensions: this.getAllExtensions() }, ...perCodec]
  }

  encodeDefault(project: Project): string {
    return this.getDefault().encode(project)
  }

  decodeAuto(raw: string): { project: Project; codecId: string } {
    for (const codec of this.codecs.values()) {
      if (codec.canDecode(raw)) {
        return { project: codec.decode(raw), codecId: codec.id }
      }
    }
    throw new Error('No registered codec could decode the provided project data')
  }
}

export function createDefaultCodecRegistry(): CodecRegistry {
  const registry = new CodecRegistry()
  registry.register(new SimpleJsonV1Codec(), true)
  return registry
}
