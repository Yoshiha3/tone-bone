// @vitest-environment jsdom
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadAllResourcePacks } from '../../src/main/packRepository'
import { SettingsRepository } from '../../src/main/settingsRepository'
import { mergeResourcePacks } from '@packs/packMerger'
import { applyPackTheme } from '@packs/themeApplier'

describe('Resource Pack & Settings Pipeline (Integration)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const d of tempDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('loads builtin + user packs from disk, merges layers, and applies CSS variables to DOM', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-pack-test-'))
    tempDirs.push(tempRoot)

    // Create a user custom pack in temp workspace
    const userPackDir = join(tempRoot, 'packs', 'custom-accent')
    mkdirSync(join(userPackDir, 'theme'), { recursive: true })
    writeFileSync(
      join(userPackDir, 'pack.json'),
      JSON.stringify({
        id: 'custom-accent',
        name: 'Custom Accent',
        version: '0.1.0',
        author: 'User',
        description: 'Overrides only accent color'
      })
    )
    writeFileSync(
      join(userPackDir, 'theme', 'tokens.json'),
      JSON.stringify({ '--accent-primary': '#22aa88' })
    )
    writeFileSync(join(userPackDir, 'theme', 'override.css'), 'body { letter-spacing: 0.01em; }')

    const builtinDir = resolve(__dirname, '../../resources/packs')
    const packs = loadAllResourcePacks(builtinDir, join(tempRoot, 'packs'))
    expect(packs.map((p) => p.meta.id)).toEqual(
      expect.arrayContaining(['default-minimal', 'minimal-dark', 'custom-accent'])
    )

    const merged = mergeResourcePacks(packs, ['default-minimal', 'minimal-dark', 'custom-accent'])
    expect(merged.tokens['--bg-app']).toBe('#16191f') // from minimal-dark
    expect(merged.tokens['--accent-primary']).toBe('#22aa88') // overridden by custom-accent
    expect(merged.instruments.some((i) => i.id === 'soft-sine')).toBe(true) // from default-minimal
    expect(merged.instruments.some((i) => i.id === 'glass-bell')).toBe(true) // added by minimal-dark

    applyPackTheme(merged, document)

    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#16191f')
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#22aa88')
    const styleEl = document.getElementById('tonebone-pack-override-css')
    expect(styleEl?.textContent).toContain('letter-spacing: 0.01em')
  })

  it('persists workspace settings and creates projects/exports/packs folders', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-settings-test-'))
    tempDirs.push(tempRoot)

    const userDataDir = join(tempRoot, 'userData')
    const defaultWorkspace = join(tempRoot, 'Documents', 'ToneBone')
    const customWorkspace = join(tempRoot, 'CustomWorkspace')
    mkdirSync(userDataDir, { recursive: true })

    const repo = new SettingsRepository(userDataDir, defaultWorkspace)
    const initial = repo.load()
    expect(initial.workspaceDir).toBe(defaultWorkspace)

    repo.save({
      workspaceDir: customWorkspace,
      activePackIds: ['default-minimal', 'minimal-dark'],
      noteLengthMode: 'grid-step'
    })
    const reloaded = repo.load()
    expect(reloaded.workspaceDir).toBe(customWorkspace)
    expect(reloaded.activePackIds).toEqual(['default-minimal', 'minimal-dark'])
    expect(reloaded.noteLengthMode).toBe('grid-step')
  })
})
