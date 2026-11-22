import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { EditorSettingsTab } from './settings/EditorSettingsTab'
import { PacksSettingsTab } from './settings/PacksSettingsTab'
import { StorageSettingsTab } from './settings/StorageSettingsTab'
import styles from './SettingsModal.module.css'

type SettingsTabId = 'packs' | 'editor' | 'storage'

const TABS: readonly { id: SettingsTabId; label: string; testId: string }[] = [
  { id: 'packs', label: 'リソースパック', testId: 'tab-packs' },
  { id: 'editor', label: 'エディタ', testId: 'tab-editor' },
  { id: 'storage', label: '保存先フォルダ', testId: 'tab-storage' }
]

export function SettingsModal() {
  const open = useProjectStore((s) => s.settingsOpen)
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('packs')

  if (!open) return null

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
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={tab.testId}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'packs' && <PacksSettingsTab />}
        {activeTab === 'editor' && <EditorSettingsTab />}
        {activeTab === 'storage' && <StorageSettingsTab />}
      </div>
    </div>
  )
}
