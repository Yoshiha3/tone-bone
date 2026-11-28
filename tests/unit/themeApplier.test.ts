// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { MergedThemeConfig } from '@core/types'
import { FALLBACK_VISUALIZER_PRESET } from '@packs/packMerger'
import { applyPackTheme } from '@packs/themeApplier'

function makeConfig(tokens: Record<string, string>, overrideCss = ''): MergedThemeConfig {
  return {
    activeThemePackIds: ['test-theme'],
    tokens,
    overrideCss,
    visualizer: FALLBACK_VISUALIZER_PRESET
  }
}

describe('applyPackTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = ''
  })

  it('applies CSS custom properties starting with -- and ignores non-custom keys', () => {
    applyPackTheme(
      makeConfig(
        {
          '--bg-app': '#121316',
          '--accent': '#4f8cff',
          invalidKey: 'red'
        },
        '.custom { opacity: 0.9; }'
      )
    )

    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#121316')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#4f8cff')
    expect(document.documentElement.style.getPropertyValue('invalidKey')).toBe('')

    const styleEl = document.getElementById('onkai-pack-override-css')
    expect(styleEl).not.toBeNull()
    expect(styleEl?.textContent).toBe('.custom { opacity: 0.9; }')
  })

  it('removes stale tokens from previous theme and reuses the single override style element', () => {
    applyPackTheme(
      makeConfig({ '--bg-app': '#111111', '--old-only': '#abcdef' }, '.v1 { color: red; }')
    )
    expect(document.documentElement.style.getPropertyValue('--old-only')).toBe('#abcdef')

    applyPackTheme(makeConfig({ '--bg-app': '#ffffff', '--new-only': '#123456' }, '.v2 {}'))

    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#ffffff')
    expect(document.documentElement.style.getPropertyValue('--new-only')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--old-only')).toBe('')

    const styleEls = document.querySelectorAll('#onkai-pack-override-css')
    expect(styleEls).toHaveLength(1)
    expect(styleEls[0].textContent).toBe('.v2 {}')
  })
})
