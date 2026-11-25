import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { describe, expect, it, vi } from 'vitest'
import {
  assertTrustedIpcEvent,
  createGuardedIpcMain,
  isAllowedRendererUrl,
  PRODUCTION_CSP
} from '../../src/main/security'

describe('Electron Security Helpers', () => {
  const rendererPath = resolve('/app/out/renderer/index.html')
  const rendererFileUrl = pathToFileURL(rendererPath).href

  it('allows only the packaged renderer HTML file in production mode', () => {
    expect(isAllowedRendererUrl(rendererFileUrl, rendererPath)).toBe(true)
    expect(isAllowedRendererUrl(`${rendererFileUrl}?view=edit#top`, rendererPath)).toBe(true)

    expect(isAllowedRendererUrl(pathToFileURL(resolve('/app/out/other.html')).href, rendererPath)).toBe(false)
    expect(isAllowedRendererUrl('https://example.com/', rendererPath)).toBe(false)
    expect(isAllowedRendererUrl('javascript:alert(1)', rendererPath)).toBe(false)
    expect(isAllowedRendererUrl('', rendererPath)).toBe(false)
  })

  it('allows only matching dev server origin in dev mode', () => {
    const devUrl = 'http://localhost:5173'
    expect(isAllowedRendererUrl('http://localhost:5173/', rendererPath, devUrl)).toBe(true)
    expect(isAllowedRendererUrl('http://localhost:5173/index.html?x=1', rendererPath, devUrl)).toBe(true)

    expect(isAllowedRendererUrl('http://localhost:5174/', rendererPath, devUrl)).toBe(false)
    expect(isAllowedRendererUrl('https://evil.example/', rendererPath, devUrl)).toBe(false)
    expect(isAllowedRendererUrl(rendererFileUrl, rendererPath, devUrl)).toBe(false)
  })

  it('guards IPC handlers against untrusted sender frames', () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const rawIpcMain = {
      handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener)
      }
    }

    const guarded = createGuardedIpcMain(rawIpcMain, (event) =>
      assertTrustedIpcEvent(event, rendererPath)
    )
    const spy = vi.fn((_event: unknown, value: unknown) => `ok:${String(value)}`)
    guarded.handle('test:channel', spy)

    const registered = handlers.get('test:channel')!
    expect(registered({ senderFrame: { url: rendererFileUrl } }, 42)).toBe('ok:42')
    expect(spy).toHaveBeenCalledTimes(1)

    expect(() => registered({ senderFrame: { url: 'https://evil.example' } }, 42)).toThrow(
      /Untrusted IPC sender/
    )
    expect(() => registered({ senderFrame: null }, 42)).toThrow(/Untrusted IPC sender/)
    expect(() => registered(null, 42)).toThrow(/Untrusted IPC sender/)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('defines a strict production CSP blocking external connections and scripts', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'self'")
    expect(PRODUCTION_CSP).toContain("script-src 'self'")
    expect(PRODUCTION_CSP).toContain("connect-src 'none'")
    expect(PRODUCTION_CSP).toContain("object-src 'none'")
  })
})
