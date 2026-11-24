import type { SaveContext, SaveStrategy } from './types'

/**
 * Manual-only persistence strategy.
 * Never writes automatically on edit; prompts save / discard / cancel before leaving when dirty.
 */
export class ManualSaveStrategy implements SaveStrategy {
  readonly id = 'manual' as const
  readonly label = '手動保存'
  readonly description =
    'Cmd/Ctrl+S または「保存」ボタンのみで保存し、未保存のまま離れる際に確認します。'
  readonly flushesSilentlyOnClose = false

  onProjectChanged(_getContext: () => SaveContext): void {
    // Manual mode never auto-saves on edit
  }

  async prepareLeave(getContext: () => SaveContext): Promise<boolean> {
    const ctx = getContext()
    if (!ctx.isDirty) return true
    const decision = await ctx.askLeaveDecision()
    if (decision === 'save') {
      return ctx.saveExplicitly()
    }
    return decision === 'discard'
  }

  dispose(): void {
    // No timers or resources to release
  }
}
