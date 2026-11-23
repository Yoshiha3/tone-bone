import type { SaveContext, SaveStrategy } from './types'

/**
 * Automatically persists workspace-backed projects after a short debounce window,
 * and flushes any pending changes immediately before leaving the editor.
 */
export class DebouncedAutoSaveStrategy implements SaveStrategy {
  readonly id = 'auto' as const
  readonly label = '自動保存'

  private readonly delayMs: number
  private timerId: ReturnType<typeof setTimeout> | null = null

  constructor(delayMs = 1200) {
    this.delayMs = delayMs
  }

  onProjectChanged(getContext: () => SaveContext): void {
    this.clearTimer()
    const ctx = getContext()
    if (!ctx.hasFilePath || !ctx.isDirty) return

    this.timerId = setTimeout(() => {
      this.timerId = null
      const latest = getContext()
      if (latest.hasFilePath && latest.isDirty) {
        void latest.saveQuietly()
      }
    }, this.delayMs)
  }

  async prepareLeave(getContext: () => SaveContext): Promise<boolean> {
    this.clearTimer()
    const ctx = getContext()
    if (!ctx.isDirty) return true
    if (ctx.hasFilePath) {
      return ctx.saveQuietly()
    }
    const decision = await ctx.askLeaveDecision()
    if (decision === 'save') {
      return ctx.saveExplicitly()
    }
    return decision === 'discard'
  }

  dispose(): void {
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}
