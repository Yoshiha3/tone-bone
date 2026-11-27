// @vitest-environment jsdom
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadAllSoundPacks, loadAllThemePacks } from '../../src/main/packRepository'
import { SettingsRepository } from '../../src/main/settingsRepository'
import { mergeSoundPacks, mergeThemePacks } from '@packs/packMerger'
import { applyPackTheme } from '@packs/themeApplier'

describe('Theme & Sound Pack + Settings Pipeline (Integration)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const d of tempDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('loads builtin + user theme/sound packs independently so disabling Minimal Light preserves all sounds', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-pack-test-'))
    tempDirs.push(tempRoot)

    // Create a user custom theme pack in themes/
    const userThemeDir = join(tempRoot, 'themes', 'custom-accent')
    mkdirSync(userThemeDir, { recursive: true })
    writeFileSync(
      join(userThemeDir, 'pack.json'),
      JSON.stringify({
        id: 'custom-accent',
        name: 'Custom Accent',
        version: '0.1.0',
        author: 'User',
        description: 'Overrides only accent color'
      })
    )
    writeFileSync(
      join(userThemeDir, 'tokens.json'),
      JSON.stringify({ '--accent-primary': '#22aa88' })
    )
    writeFileSync(join(userThemeDir, 'override.css'), 'body { letter-spacing: 0.01em; }')

    // Create a user custom sound pack in sounds/
    const userSoundDir = join(tempRoot, 'sounds', 'retro-pack')
    mkdirSync(userSoundDir, { recursive: true })
    writeFileSync(
      join(userSoundDir, 'pack.json'),
      JSON.stringify({
        id: 'retro-pack',
        name: 'Retro Pack',
        version: '0.1.0',
        author: 'User',
        description: 'Adds a chiptune synth'
      })
    )
    writeFileSync(
      join(userSoundDir, 'instruments.json'),
      JSON.stringify([
        {
          id: 'retro-pulse',
          name: 'Retro Pulse',
          type: 'synth',
          synth: { waveform: 'square', attack: 0.004, decay: 0.1, sustain: 0.4, release: 0.1 }
        }
      ])
    )

    const builtinThemesDir = resolve(__dirname, '../../resources/themes')
    const builtinSoundsDir = resolve(__dirname, '../../resources/sounds')

    const themes = loadAllThemePacks(builtinThemesDir, join(tempRoot, 'themes'))
    expect(themes.map((p) => p.meta.id)).toEqual(
      expect.arrayContaining(['minimal-light', 'minimal-dark', 'custom-accent'])
    )

    const sounds = loadAllSoundPacks(builtinSoundsDir, join(tempRoot, 'sounds'))
    expect(sounds.map((p) => p.meta.id)).toEqual(
      expect.arrayContaining(['default-sounds', 'retro-pack'])
    )

    // Activate Minimal Dark + Custom Accent (WITHOUT Minimal Light)
    const mergedTheme = mergeThemePacks(themes, ['minimal-dark', 'custom-accent'])
    expect(mergedTheme.tokens['--bg-app']).toBe('#16191f')
    expect(mergedTheme.tokens['--accent-primary']).toBe('#22aa88')

    // Sounds are completely independent and always retain default-sounds + user pack
    const mergedSounds = mergeSoundPacks(sounds, ['retro-pack'])
    expect(mergedSounds.activeSoundPackIds).toEqual(['default-sounds', 'retro-pack'])
    expect(mergedSounds.instruments.some((i) => i.id === 'soft-sine')).toBe(true)
    expect(mergedSounds.instruments.some((i) => i.id === 'glass-bell')).toBe(true)
    expect(mergedSounds.instruments.some((i) => i.id === 'basic-kit')).toBe(true)
    expect(mergedSounds.instruments.some((i) => i.id === 'retro-pulse')).toBe(true)

    applyPackTheme(mergedTheme, document)
    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#16191f')
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#22aa88')
    const styleEl = document.getElementById('tonebone-pack-override-css')
    expect(styleEl?.textContent).toContain('letter-spacing: 0.01em')

    // Disabling a theme pack removes previously applied custom tokens not present in remaining packs
    const withCustomToken = {
      ...mergedTheme,
      tokens: { ...mergedTheme.tokens, '--custom-ephemeral': '#ff00ff' }
    }
    applyPackTheme(withCustomToken, document)
    expect(document.documentElement.style.getPropertyValue('--custom-ephemeral')).toBe('#ff00ff')

    const darkOnly = mergeThemePacks(themes, ['minimal-dark'])
    applyPackTheme(darkOnly, document)
    expect(document.documentElement.style.getPropertyValue('--custom-ephemeral')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--font-ui')).toBe('')
    expect(document.getElementById('tonebone-pack-override-css')?.textContent).toBe('')
  })

  it('persists workspace settings, creates themes/sounds folders, and falls back cleanly on missing defaults', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'tonebone-settings-test-'))
    tempDirs.push(tempRoot)

    const userDataDir = join(tempRoot, 'userData')
    const defaultWorkspace = join(tempRoot, 'Documents', 'ToneBone')
    const customWorkspace = join(tempRoot, 'CustomWorkspace')
    mkdirSync(userDataDir, { recursive: true })

    const repo = new SettingsRepository(userDataDir, defaultWorkspace)
    const initial = repo.load()
    expect(initial.workspaceDir).toBe(defaultWorkspace)
    expect(initial.activeThemePackIds).toEqual(['minimal-light'])
    expect(initial.activeSoundPackIds).toEqual(['default-sounds'])
    expect(initial.noteLengthMode).toBe('last-used')
    expect(initial.noteInputMode).toBe('click')
    expect(initial.noteDrawKey).toBe('KeyA')
    expect(initial.saveMode).toBe('auto')

    repo.save({
      workspaceDir: customWorkspace,
      activeThemePackIds: ['minimal-dark'],
      activeSoundPackIds: ['default-sounds'],
      noteLengthMode: 'grid-step',
      noteInputMode: 'key',
      noteDrawKey: 'KeyD',
      saveMode: 'manual'
    })
    const reloaded = repo.load()
    expect(reloaded.workspaceDir).toBe(customWorkspace)
    expect(reloaded.activeThemePackIds).toEqual(['minimal-dark'])
    expect(reloaded.activeSoundPackIds).toEqual(['default-sounds'])
    expect(reloaded.noteLengthMode).toBe('grid-step')
    expect(reloaded.noteInputMode).toBe('key')
    expect(reloaded.noteDrawKey).toBe('KeyD')
    expect(reloaded.saveMode).toBe('manual')

    // Invalid persisted values fall back to safe defaults
    writeFileSync(
      join(userDataDir, 'settings.json'),
      JSON.stringify({
        workspaceDir: customWorkspace,
        noteInputMode: 'invalid',
        noteDrawKey: 'Space'
      })
    )
    const sanitized = repo.load()
    expect(sanitized.noteInputMode).toBe('click')
    expect(sanitized.noteDrawKey).toBe('KeyA')
  })
})
