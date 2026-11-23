import { useProjectStore } from '../../store/useProjectStore'
import { PackListPanel } from './PackListPanel'

export function ThemeSettingsTab() {
  const availableThemePacks = useProjectStore((s) => s.availableThemePacks)
  const activeThemePackIds = useProjectStore((s) => s.settings.activeThemePackIds)
  const setActiveThemePackIds = useProjectStore((s) => s.setActiveThemePackIds)
  const reloadThemePacks = useProjectStore((s) => s.reloadThemePacks)
  const openFolder = useProjectStore((s) => s.openFolder)

  return (
    <PackListPanel
      packs={availableThemePacks}
      activePackIds={activeThemePackIds}
      hint="配色・フォント・Stage Mode の見た目を変更します。上にあるパックほど優先して適用されます（音源には影響しません）。"
      folderButtonLabel="テーマフォルダを開く"
      testIdPrefix="theme"
      onChangeActiveIds={(ids) => void setActiveThemePackIds(ids)}
      onOpenFolder={() => void openFolder('themes')}
      onReload={() => void reloadThemePacks()}
    />
  )
}
