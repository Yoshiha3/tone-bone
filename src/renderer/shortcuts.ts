import type { ProjectStoreState, ViewMode } from './store/types'

export interface ShortcutKeyEvent {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  isTextInput: boolean
}

export interface ShortcutActions {
  togglePlayPause: () => void
  requestNewProject: () => Promise<boolean>
  getCurrentTick: () => number
}

export interface ShortcutContext {
  state: ProjectStoreState
  actions: ShortcutActions
}

export interface ShortcutBinding {
  readonly id: string
  readonly description: string
  readonly views: readonly ViewMode[] | 'any'
  readonly keys?: readonly string[]
  readonly code?: string
  readonly mod?: boolean
  readonly shift?: boolean
  readonly allowInOverlay?: boolean
  readonly preventDefault?: boolean
  readonly when?: (ctx: ShortcutContext) => boolean
  readonly run: (ctx: ShortcutContext) => unknown
}

/**
 * Declarative global keyboard shortcut table.
 * Adding, remapping, or displaying shortcuts only requires editing this table.
 */
export const SHORTCUT_BINDINGS: readonly ShortcutBinding[] = [
  {
    id: 'escape-overlay-or-stage',
    description: 'モーダルを閉じる / Stage Mode を終了',
    views: 'any',
    keys: ['escape'],
    allowInOverlay: true,
    preventDefault: false,
    run: ({ state }) => {
      if (state.unsavedPrompt) state.resolveLeaveDecision('cancel')
      else if (state.settingsOpen) state.setSettingsOpen(false)
      else if (state.viewMode === 'stage') state.setViewMode('edit')
    }
  },
  {
    id: 'new-project',
    description: '新規プロジェクトを作成',
    views: ['home', 'edit'],
    keys: ['n'],
    mod: true,
    run: ({ actions }) => actions.requestNewProject()
  },
  {
    id: 'home-open-selected',
    description: '選択中のプロジェクトを開く',
    views: ['home'],
    keys: ['enter'],
    when: ({ state }) => Boolean(state.selectedHomeProjectPath),
    run: ({ state }) => {
      if (state.selectedHomeProjectPath) {
        return state.openWorkspaceProject(state.selectedHomeProjectPath)
      }
    }
  },
  {
    id: 'toggle-play-pause',
    description: '再生 / 一時停止',
    views: ['edit', 'stage'],
    code: 'Space',
    run: ({ actions }) => actions.togglePlayPause()
  },
  {
    id: 'redo',
    description: 'やり直し',
    views: ['edit'],
    keys: ['z'],
    mod: true,
    shift: true,
    run: ({ state }) => state.redo()
  },
  {
    id: 'undo',
    description: '元に戻す',
    views: ['edit'],
    keys: ['z'],
    mod: true,
    shift: false,
    run: ({ state }) => state.undo()
  },
  {
    id: 'copy-notes',
    description: '選択中のノーツをコピー',
    views: ['edit'],
    keys: ['c'],
    mod: true,
    run: ({ state }) => state.copySelectedNotes()
  },
  {
    id: 'paste-notes',
    description: '現在位置にノーツをペースト',
    views: ['edit'],
    keys: ['v'],
    mod: true,
    run: ({ state, actions }) => state.pasteNotes(Math.round(actions.getCurrentTick()))
  },
  {
    id: 'save-project-as',
    description: '別名で保存',
    views: ['edit'],
    keys: ['s'],
    mod: true,
    shift: true,
    run: ({ state }) => state.saveProjectAs()
  },
  {
    id: 'save-project',
    description: '上書き保存',
    views: ['edit'],
    keys: ['s'],
    mod: true,
    shift: false,
    run: ({ state }) => state.saveProject()
  },
  {
    id: 'delete-selected-notes',
    description: '選択中のノーツを削除',
    views: ['edit'],
    keys: ['delete', 'backspace'],
    run: ({ state }) => state.deleteSelectedNotes()
  }
]

function matchesBinding(
  binding: ShortcutBinding,
  event: ShortcutKeyEvent,
  ctx: ShortcutContext
): boolean {
  const overlayOrInput =
    event.isTextInput || ctx.state.settingsOpen || Boolean(ctx.state.unsavedPrompt)
  if (overlayOrInput && !binding.allowInOverlay) return false

  if (binding.views !== 'any' && !binding.views.includes(ctx.state.viewMode)) {
    return false
  }

  const mod = event.metaKey || event.ctrlKey
  if (binding.mod !== undefined && binding.mod !== mod) return false
  if (binding.shift !== undefined && binding.shift !== event.shiftKey) return false

  if (binding.code !== undefined && event.code !== binding.code) return false
  if (binding.keys !== undefined && !binding.keys.includes(event.key.toLowerCase())) {
    return false
  }
  if (binding.when && !binding.when(ctx)) return false

  return true
}

/**
 * Finds the first matching shortcut binding, runs it, and reports whether
 * the browser event should call `preventDefault()`.
 */
export function dispatchKeyboardShortcut(
  event: ShortcutKeyEvent,
  ctx: ShortcutContext,
  bindings: readonly ShortcutBinding[] = SHORTCUT_BINDINGS
): { matched: boolean; preventDefault: boolean; id?: string } {
  for (const binding of bindings) {
    if (!matchesBinding(binding, event, ctx)) continue
    void binding.run(ctx)
    return {
      matched: true,
      preventDefault: binding.preventDefault !== false,
      id: binding.id
    }
  }
  return { matched: false, preventDefault: false }
}
