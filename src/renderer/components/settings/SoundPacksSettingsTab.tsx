import { DEFAULT_SOUND_PACK_ID } from '@core/types'
import { useProjectStore } from '../../store/useProjectStore'
import { PackListPanel } from './PackListPanel'

export function SoundPacksSettingsTab() {
  const availableSoundPacks = useProjectStore((s) => s.availableSoundPacks)
  const activeSoundPackIds = useProjectStore((s) => s.settings.activeSoundPackIds)
  const setActiveSoundPackIds = useProjectStore((s) => s.setActiveSoundPackIds)
  const reloadSoundPacks = useProjectStore((s) => s.reloadSoundPacks)
  const openFolder = useProjectStore((s) => s.openFolder)

  return (
    <PackListPanel
      packs={availableSoundPacks}
      activePackIds={activeSoundPackIds}
      pinnedBaseId={DEFAULT_SOUND_PACK_ID}
      hint="標準ベース音源は常に有効です。ユーザー追加の音源パックを上に重ねて音色を追加・上書きできます。"
      folderButtonLabel="音源フォルダを開く"
      testIdPrefix="sound"
      onChangeActiveIds={(ids) => void setActiveSoundPackIds(ids)}
      onOpenFolder={() => void openFolder('sounds')}
      onReload={() => void reloadSoundPacks()}
    />
  )
}
