import type { MergedPackConfig } from '@core/types'

const OVERRIDE_STYLE_ID = 'tonebone-pack-override-css'
const appliedTokenKeysByDoc = new WeakMap<Document, Set<string>>()

/**
 * Applies merged resource pack tokens (CSS custom properties) and optional
 * override CSS to the given Document at runtime without rebuilding.
 * Previously applied tokens absent from the new config are removed so
 * CSS `:root` fallbacks take effect cleanly.
 */
export function applyPackTheme(config: MergedPackConfig, doc: Document = document): void {
  const root = doc.documentElement
  const prevKeys = appliedTokenKeysByDoc.get(doc) ?? new Set<string>()
  const nextKeys = new Set<string>()

  for (const [key, value] of Object.entries(config.tokens)) {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value)
      nextKeys.add(key)
    }
  }

  for (const key of prevKeys) {
    if (!nextKeys.has(key)) {
      root.style.removeProperty(key)
    }
  }
  appliedTokenKeysByDoc.set(doc, nextKeys)

  let styleEl = doc.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.id = OVERRIDE_STYLE_ID
    doc.head.appendChild(styleEl)
  }
  styleEl.textContent = config.overrideCss
}
