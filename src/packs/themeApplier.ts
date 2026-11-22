import type { MergedPackConfig } from '@core/types'

const OVERRIDE_STYLE_ID = 'tonebone-pack-override-css'

/**
 * Applies merged resource pack tokens (CSS custom properties) and optional
 * override CSS to the given Document at runtime without rebuilding.
 */
export function applyPackTheme(config: MergedPackConfig, doc: Document = document): void {
  const root = doc.documentElement
  for (const [key, value] of Object.entries(config.tokens)) {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value)
    }
  }

  let styleEl = doc.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.id = OVERRIDE_STYLE_ID
    doc.head.appendChild(styleEl)
  }
  styleEl.textContent = config.overrideCss
}
