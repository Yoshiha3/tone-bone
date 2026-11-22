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
