import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { _electron as electron, expect, test } from '@playwright/test'

const ARTIFACT_DIR =
  process.env.TONEBONE_SCREENSHOT_DIR || resolve(__dirname, '../../test-results')

test.describe('Tone Bone Electron E2E', () => {
  test('boots app, edits tracks/triplets/notes, switches Stage Mode, and swaps Resource Packs', async () => {
    const tempUserData = mkdtempSync(join(tmpdir(), 'tonebone-e2e-'))
    const appPath = resolve(__dirname, '../..')

    const electronApp = await electron.launch({
      args: [appPath, `--user-data-dir=${tempUserData}`]
    })

    const pageErrors: string[] = []
    try {
      const win = await electronApp.firstWindow()
      win.on('pageerror', (err) => pageErrors.push(err.message))

      await win.waitForSelector('[data-testid="transport-bar"]')
      await win.waitForSelector('[data-testid="track-list"]')
      await win.waitForSelector('[data-testid="piano-roll-canvas"]')
      // Allow initial theme tokens and canvas render frame to settle
      await win.waitForTimeout(300)

      // 1. Verify initial Minimal Light theme & capture Edit Mode screenshot
      const initialBg = await win.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()
      )
      expect(initialBg).toBe('#f6f7f9')

      await win.screenshot({ path: join(ARTIFACT_DIR, 'edit-minimal-light.png') })

      // 2. BPM change (including intermediate single-digit typing like '1' -> '154' -> '124') & triplet grid
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

      // 3. Add track, rename via double-click, & toggle Mute/Solo
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
      await melodyMute.click() // un-mute so all tracks remain audible for Stage Mode
      const melodySolo = win.getByTestId('solo-btn-track-melody')
      await melodySolo.click()
      await melodySolo.click()

      // 4. Place a note with slight cursor drift (4px) and test Undo/Redo
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

      // 5. Switch to Stage Mode, capture screenshot, then return to Edit Mode
      await win.getByTestId('stage-mode-btn').click()
      await win.waitForSelector('[data-testid="stage-visualizer"]')
      await win.getByTestId('stage-play-btn').click()
      await win.waitForTimeout(350)
      await win.screenshot({ path: join(ARTIFACT_DIR, 'stage-mode-light.png') })
      await win.getByTestId('stage-play-btn').click()
      await win.getByTestId('exit-stage-btn').click()
      await win.waitForSelector('[data-testid="piano-roll"]')

      // 6. Open Settings Modal, verify Storage tab, and switch to Minimal Dark resource pack
      await win.getByTestId('settings-btn').click()
      await win.waitForSelector('[data-testid="settings-modal"]')

      await win.getByTestId('tab-editor').click()
      await expect(win.getByTestId('note-len-last-used-btn')).toHaveAttribute('aria-checked', 'true')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'settings-editor.png') })
      await win.getByTestId('note-len-grid-step-btn').click()
      await expect(win.getByTestId('note-len-grid-step-btn')).toHaveAttribute('aria-checked', 'true')
      await win.getByTestId('note-len-last-used-btn').click()
      await expect(win.getByTestId('note-len-last-used-btn')).toHaveAttribute('aria-checked', 'true')

      await win.getByTestId('tab-storage').click()
      const wsPath = await win.getByTestId('workspace-path').textContent()
      expect(wsPath).toContain('ToneBone')

      await win.getByTestId('tab-packs').click()
      await expect(win.getByTestId('pack-toggle-default-minimal')).toHaveAttribute('aria-checked', 'true')
      await expect(win.getByTestId('pack-toggle-minimal-dark')).toHaveAttribute('aria-checked', 'false')
      await win.getByTestId('pack-toggle-minimal-dark').click()
      await win.waitForTimeout(200)
      await expect(win.getByTestId('pack-toggle-minimal-dark')).toHaveAttribute('aria-checked', 'true')
      await win.screenshot({ path: join(ARTIFACT_DIR, 'settings-packs.png') })

      const darkBg = await win.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()
      )
      expect(darkBg).toBe('#16191f')

      await win.getByTestId('settings-close-btn').click()
      await win.waitForTimeout(250)
      await win.screenshot({ path: join(ARTIFACT_DIR, 'edit-minimal-dark.png') })

      // 7. Create a new project (accept unsaved confirmation dialog)
      win.once('dialog', (d) => void d.accept())
      await win.getByTestId('new-project-btn').click()
      await expect(win.locator('[data-testid^="track-card-"]')).toHaveCount(2)
      await expect(win.getByTestId('track-name-track-synth-1')).toHaveText('Synth 1')

      expect(pageErrors).toEqual([])
    } finally {
      await electronApp.close()
      rmSync(tempUserData, { recursive: true, force: true })
    }
  })
})
