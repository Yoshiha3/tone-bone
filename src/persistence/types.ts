import type { SaveMode } from '@core/types'

export type LeaveDecision = 'save' | 'discard' | 'cancel'

export interface SaveContext {
  /** Whether the active project is already linked to a file path on disk */
  readonly hasFilePath: boolean
  /** Whether there are unsaved changes in memory */
  readonly isDirty: boolean
  /** Silently writes to the current file path without prompting */
  saveQuietly(): Promise<boolean>
  /** Saves explicitly (overwrites current file or opens Save As dialog if unsaved) */
  saveExplicitly(): Promise<boolean>
  /** Prompts the user to save, discard, or cancel when leaving with unsaved changes */
  askLeaveDecision(): Promise<LeaveDecision>
}

/**
 * Pluggable project persistence strategy interface.
 * Controls how project mutations are saved and how leaving an edited project behaves.
 */
export interface SaveStrategy {
  readonly id: SaveMode
  readonly label: string
  onProjectChanged(getContext: () => SaveContext): void
  prepareLeave(getContext: () => SaveContext): Promise<boolean>
  dispose(): void
}
