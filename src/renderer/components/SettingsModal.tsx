import { useState, type ComponentType } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { EditorSettingsTab } from './settings/EditorSettingsTab'
import { SoundPacksSettingsTab } from './settings/SoundPacksSettingsTab'
import { StorageSettingsTab } from './settings/StorageSettingsTab'
import { ThemeSettingsTab } from './settings/ThemeSettingsTab'
import styles from './SettingsModal.module.css'

interface SettingsTabDef {
  readonly id: string
  readonly label: string
  readonly testId: string
  readonly component: ComponentType
}

/**
 * Single source of truth for settings tabs.
 * Adding a new tab only requires appending an entry to this array.
 */
export const SETTINGS_TABS = [
  { id: 'themes', label: 'テーマ', testId: 'tab-themes', component: ThemeSettingsTab },
  { id: 'sounds', label: '音源パック', testId: 'tab-sounds', component: SoundPacksSettingsTab },
  { id: 'editor', label: 'エディタ', testId: 'tab-editor', component: EditorSettingsTab },
  { id: 'storage', label: '保存先フォルダ', testId: 'tab-storage', component: StorageSettingsTab }
] as const satisfies readonly SettingsTabDef[]

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export function SettingsModal() {
  const open = useProjectStore((s) => s.settingsOpen)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const [activeTabId, setActiveTabId] = useState<SettingsTabId>(SETTINGS_TABS[0].id)

  if (!open) return null

  const activeTab = SETTINGS_TABS.find((t) => t.id === activeTabId) ?? SETTINGS_TABS[0]
  const ActiveTabComponent = activeTab.component

  return (
    <div
      className={styles.backdrop}
      onClick={() => setSettingsOpen(false)}
      data-testid="settings-modal"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>設定</span>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            data-testid="settings-close-btn"
          >
            閉じる
          </button>
        </div>

        <div className={styles.tabs}>
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabBtn} ${activeTab.id === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              data-testid={tab.testId}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ActiveTabComponent />
      </div>
    </div>
  )
}
