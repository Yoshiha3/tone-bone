import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { _electron as electron, expect, test } from '@playwright/test'

const ARTIFACT_DIR =
  process.env.TONEBONE_SCREENSHOT_DIR || resolve(__dirname, '../../test-results')

test.describe('Tone Bone Electron E2E', () => {
  test('manages projects on Home screen, edits tracks/triplets/notes, switches Stage Mode, and swaps Resource Packs', async () => {
    const tempUserData = mkdtempSync(join(tmpdir(), 'tonebone-e2e-'))
    const tempWorkspace = mkdtempSync(join(tmpdir(), 'tonebone-e2e-ws-'))
    const appPath = resolve(__dirname, '../..')

    // Point settings.json to an isolated temp workspace so user Documents stays untouched
    const { writeFileSync } = await import('fs')
    writeFileSync(
      join(tempUserData, 'settings.json'),
      JSON.stringify({
        workspaceDir: tempWorkspace,
        activeThemePackIds: ['minimal-light'],
        activeSoundPackIds: ['default-sounds'],
        noteLengthMode: 'last-used',
        saveMode: 'auto'
      })
    )

    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const electronApp = await electron.launch({
      args: [appPath, `--user-data-dir=${tempUserData}`],
      env: launchEnv as Record<string, string>
    })

    const pageErrors: string[] = []
    try {
      const win = await electronApp.firstWindow()
      win.on('pageerror', (err) => pageErrors.push(err.message))

      // 1. Boots to Home screen in Empty State with Minimal Light theme
      await win.waitForSelector('[data-testid="home-view"]')
      await win.waitForSelector('[data-testid="home-empty-state"]')
      await win.waitForTimeout(250)

      const initialBg = await win.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()
      )
      expect(initialBg).toBe('#f6f7f9')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'home-empty-light.png') })

      // 2. Add demo project, rename on Home screen, duplicate & delete copy, then double-click to open
      await win.getByTestId('empty-add-demo-btn').click()
      await win.waitForSelector('[data-testid="home-project-grid"]')
      await expect(win.getByTestId('project-card-0')).toHaveAttribute(
        'data-project-title',
        'Simple Sketch'
      )

      await win.getByTestId('project-rename-btn-0').click()
      const homeRenameInput = win.getByTestId('project-rename-input-0')
      await homeRenameInput.fill('Evening Sketch')
      await homeRenameInput.press('Enter')
      await expect(win.getByTestId('project-card-0')).toHaveAttribute(
        'data-project-title',
        'Evening Sketch'
      )

      await win.getByTestId('project-duplicate-btn-0').click()
      await expect(win.locator('[data-testid^="project-card-"]')).toHaveCount(2)

      win.once('dialog', (d) => void d.accept())
      await win.getByTestId('project-delete-btn-0').click()
      await expect(win.locator('[data-testid^="project-card-"]')).toHaveCount(1)
      await win.screenshot({ path: join(ARTIFACT_DIR, 'home-projects-light.png') })

      // Double-click card to enter Edit Mode
      await win.getByTestId('project-card-0').dblclick()
      await win.waitForSelector('[data-testid="transport-bar"]')
      await win.waitForSelector('[data-testid="track-list"]')
      await win.waitForSelector('[data-testid="piano-roll-canvas"]')
      await expect(win.getByTestId('project-title')).toHaveText('Evening Sketch')
      await win.waitForTimeout(250)
      await win.screenshot({ path: join(ARTIFACT_DIR, 'edit-minimal-light.png') })

      // 3. BPM change (including intermediate single-digit typing like '1' -> '154' -> '124') & triplet grid
      const bpmInput = win.getByTestId('bpm-input')
      await bpmInput.fill('1')
      await expect(bpmInput).toHaveValue('1')
      await bpmInput.fill('154')
      await bpmInput.press('Enter')
      await expect(bpmInput).toHaveValue('154')
      await bpmInput.fill('124')
      await bpmInput.press('Enter')
      await expect(bpmInput).toHaveValue('124')

      const barsInput = win.getByTestId('bars-input')
      await barsInput.fill('200')
      await barsInput.press('Enter')
      await expect(barsInput).toHaveValue('200')
      // Verify virtualized canvas stays viewport-sized even at 200 bars (not 67,000px!)
      const canvasBoxAt200 = await win.getByTestId('piano-roll-canvas').boundingBox()
      expect(canvasBoxAt200).not.toBeNull()
      expect(canvasBoxAt200!.width).toBeLessThan(1600)

      await barsInput.fill('6')
      await barsInput.press('Enter')
      await expect(barsInput).toHaveValue('6')

      const gridSelect = win.getByTestId('grid-select')
      await gridSelect.selectOption('1/12')
      await expect(gridSelect).toHaveValue('1/12')

      // 4. Add track, rename via double-click, & toggle Mute/Solo
      const beforeCards = await win.locator('[data-testid^="track-card-"]').count()
      await win.getByTestId('add-synth-track-btn').click()
      await expect(win.locator('[data-testid^="track-card-"]')).toHaveCount(beforeCards + 1)

      await win.getByTestId('track-name-track-melody').dblclick()
      const renameInput = win.getByTestId('track-name-input-track-melody')
      await renameInput.fill('Main Lead')
      await renameInput.press('Enter')
      await expect(win.getByTestId('track-name-track-melody')).toHaveText('Main Lead')

      const melodyMute = win.getByTestId('mute-btn-track-melody')
      await melodyMute.click()
      await melodyMute.click()
      const melodySolo = win.getByTestId('solo-btn-track-melody')
      await melodySolo.click()
      await melodySolo.click()

      // 5. Place a note with slight cursor drift (4px) and test Undo/Redo
      const canvas = win.getByTestId('piano-roll-canvas')
      const box = await canvas.boundingBox()
      expect(box).not.toBeNull()
      if (box) {
        await win.mouse.move(box.x + 140, box.y + 120)
        await win.mouse.down()
        await win.mouse.move(box.x + 144, box.y + 122)
        await win.mouse.up()
      }
      const undoBtn = win.getByTestId('undo-btn')
      const redoBtn = win.getByTestId('redo-btn')
      await expect(undoBtn).toBeEnabled()
      await undoBtn.click()
      await expect(redoBtn).toBeEnabled()
      await redoBtn.click()

      // 6. Switch to Stage Mode, verify renamed title, capture screenshot, then return to Edit Mode
      await win.getByTestId('stage-mode-btn').click()
      await win.waitForSelector('[data-testid="stage-visualizer"]')
      await expect(win.getByTestId('stage-visualizer')).toContainText('Evening Sketch')
      await win.getByTestId('stage-play-btn').click()
      await win.waitForTimeout(350)
      await win.screenshot({ path: join(ARTIFACT_DIR, 'stage-mode-light.png') })
      await win.getByTestId('stage-play-btn').click()
      await win.getByTestId('exit-stage-btn').click()
      await win.waitForSelector('[data-testid="piano-roll"]')

      // 7. Open Settings Modal, verify Editor (note length + save mode), Storage, and Minimal Dark pack
      await win.getByTestId('settings-btn').click()
      await win.waitForSelector('[data-testid="settings-modal"]')

      await win.getByTestId('tab-editor').click()
      await expect(win.getByTestId('note-len-last-used-btn')).toHaveAttribute('aria-checked', 'true')
      await expect(win.getByTestId('save-mode-auto-btn')).toHaveAttribute('aria-checked', 'true')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'settings-editor.png') })
      await win.getByTestId('save-mode-manual-btn').click()
      await expect(win.getByTestId('save-mode-manual-btn')).toHaveAttribute('aria-checked', 'true')
      await win.getByTestId('save-mode-auto-btn').click()
      await expect(win.getByTestId('save-mode-auto-btn')).toHaveAttribute('aria-checked', 'true')

      await win.getByTestId('tab-storage').click()
      const wsPath = await win.getByTestId('workspace-path').textContent()
      expect(wsPath).toBe(tempWorkspace)

      await win.getByTestId('tab-themes').click()
      await expect(win.getByTestId('theme-toggle-minimal-light')).toHaveAttribute('aria-checked', 'true')
      await expect(win.getByTestId('theme-toggle-minimal-dark')).toHaveAttribute('aria-checked', 'false')
      await win.getByTestId('theme-toggle-minimal-dark').click()
      await win.getByTestId('theme-toggle-minimal-light').click()
      await win.waitForTimeout(200)
      await expect(win.getByTestId('theme-toggle-minimal-dark')).toHaveAttribute('aria-checked', 'true')
      await expect(win.getByTestId('theme-toggle-minimal-light')).toHaveAttribute('aria-checked', 'false')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'settings-themes.png') })

      await win.getByTestId('tab-sounds').click()
      await expect(win.getByTestId('sound-toggle-default-sounds')).toHaveAttribute('aria-checked', 'true')
      await expect(win.getByTestId('sound-toggle-default-sounds')).toBeDisabled()
      await win.screenshot({ path: join(ARTIFACT_DIR, 'settings-sounds.png') })

      const darkBg = await win.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()
      )
      expect(darkBg).toBe('#16191f')

      await win.getByTestId('settings-close-btn').click()
      await win.waitForTimeout(250)
      // Verify standard synth & drum instruments remain intact even with Minimal Light disabled!
      await expect(win.getByLabel('Main Lead 音色')).toContainText('Soft Sine')
      await expect(win.getByLabel('Main Lead 音色')).toContainText('Glass Bell')
      await expect(win.getByLabel('Rhythm 音色')).toContainText('Basic Rhythm Kit')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'edit-minimal-dark.png') })

      // 8. Return to Home screen (auto-save flushes edits with no confirmation popup)
      await win.getByTestId('home-btn').click()
      await win.waitForSelector('[data-testid="home-view"]')
      const card0 = win.getByTestId('project-card-0')
      await expect(card0).toContainText('124 BPM')
      await expect(card0).toContainText('6 小節')
      await expect(card0).toContainText('4 トラック')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'home-projects-dark.png') })

      // 9. Open via the card's "編集" button, switch to manual save, verify 3-choice leave modal
      await win.getByTestId('project-edit-btn-0').click()
      await win.waitForSelector('[data-testid="piano-roll"]')
      await win.getByTestId('settings-btn').click()
      await win.getByTestId('tab-editor').click()
      await win.getByTestId('save-mode-manual-btn').click()
      await win.getByTestId('settings-close-btn').click()

      await win.getByTestId('bpm-input').fill('136')
      await win.getByTestId('bpm-input').press('Enter')
      await win.getByTestId('home-btn').click()
      await win.waitForSelector('[data-testid="unsaved-modal"]')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'unsaved-modal-dark.png') })
      await win.getByTestId('unsaved-cancel-btn').click()
      await expect(win.getByTestId('piano-roll')).toBeVisible()

      await win.getByTestId('home-btn').click()
      await win.waitForSelector('[data-testid="unsaved-modal"]')
      await win.getByTestId('unsaved-save-btn').click()
      await win.waitForSelector('[data-testid="home-view"]')
      await expect(win.getByTestId('project-card-0')).toContainText('136 BPM')

      // 10. Create a new blank project from Home screen
      await win.getByTestId('home-new-project-btn').click()
      await win.waitForSelector('[data-testid="piano-roll"]')
      await expect(win.getByTestId('project-title')).toHaveText('Untitled')
      await expect(win.locator('[data-testid^="track-card-"]')).toHaveCount(2)
      await expect(win.getByTestId('track-name-track-synth-1')).toHaveText('Synth 1')

      expect(pageErrors).toEqual([])
    } finally {
      await electronApp.close()
      rmSync(tempUserData, { recursive: true, force: true })
      rmSync(tempWorkspace, { recursive: true, force: true })
    }
  })
})
