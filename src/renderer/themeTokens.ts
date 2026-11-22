const DEFAULT_TRACK_PALETTE = [
  '#3b6ea5',
  '#3c8d7a',
  '#c07a45',
  '#7b63a8',
  '#b85c6f',
  '#547c99'
] as const

export interface ThemeTokens {
  bgGrid: string
  rowAlt: string
  surface: string
  borderSubtle: string
  lineBar: string
  lineBeat: string
  lineSub: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  playheadColor: string
  selectionFill: string
  selectionBorder: string
  trackPalette: string[]
}

export function readTrackPalette(doc: Document = document): string[] {
  const style = getComputedStyle(doc.documentElement)
  return DEFAULT_TRACK_PALETTE.map(
    (fallback, idx) => style.getPropertyValue(`--track-color-${idx}`).trim() || fallback
  )
}

export function readThemeTokens(doc: Document = document): ThemeTokens {
  const style = getComputedStyle(doc.documentElement)
  const v = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback

  return {
    bgGrid: v('--grid-bg', '#fbfcfe'),
    rowAlt: v('--grid-row-alt', '#f3f5f8'),
    surface: v('--bg-surface', '#ffffff'),
    borderSubtle: v('--border-subtle', '#e2e6ed'),
    lineBar: v('--grid-line-bar', '#c5cddb'),
    lineBeat: v('--grid-line-beat', '#dce1ea'),
    lineSub: v('--grid-line-sub', '#eceff4'),
    textPrimary: v('--text-primary', '#1e2430'),
    textSecondary: v('--text-secondary', '#5c6678'),
    textMuted: v('--text-muted', '#8c96a8'),
    playheadColor: v('--playhead', '#3b6ea5'),
    selectionFill: v('--selection-fill', 'rgba(59,110,165,0.14)'),
    selectionBorder: v('--selection-border', '#3b6ea5'),
    trackPalette: readTrackPalette(doc)
  }
}
