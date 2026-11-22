import type { Project } from '@core/types'

/**
 * Pluggable project persistence codec interface.
 * Swap or register additional codecs without changing core domain or UI logic.
 */
export interface ProjectCodec {
  readonly id: string
  readonly label: string
  readonly extensions: readonly string[]
  canDecode(raw: string): boolean
  encode(project: Project): string
  decode(raw: string): Project
}
