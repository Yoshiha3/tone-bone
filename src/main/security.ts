import type { BrowserWindow, Session } from 'electron'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { IpcMainLike } from '@platform/ipcContract'

/**
 * Strict Content Security Policy injected into the production renderer HTML.
 * Keeps theme pack `<style>` injection, Canvas, and Web Audio working while
 * blocking external scripts, network connections, and plugin objects.
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

export interface RendererSecurityOptions {
  rendererHtmlPath: string
  devServerUrl?: string
}

interface IpcEventWithSenderFrame {
  senderFrame?: { url?: string } | null
}

function normalizeComparisonPath(filePath: string): string {
  const resolved = resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isAllowedRendererUrl(
  targetUrl: string,
  rendererHtmlPath: string,
  devServerUrl?: string
): boolean {
  if (!targetUrl) return false

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return false
  }

  if (devServerUrl) {
    try {
      const devParsed = new URL(devServerUrl)
      return parsed.origin === devParsed.origin
    } catch {
      return false
    }
  }

  if (parsed.protocol !== 'file:') {
    return false
  }

  try {
    const targetPath = fileURLToPath(parsed)
    return normalizeComparisonPath(targetPath) === normalizeComparisonPath(rendererHtmlPath)
  } catch {
    return false
  }
}

export function assertTrustedIpcEvent(
  event: unknown,
  rendererHtmlPath: string,
  devServerUrl?: string
): void {
  const senderUrl = (event as IpcEventWithSenderFrame | null | undefined)?.senderFrame?.url ?? ''
  if (!isAllowedRendererUrl(senderUrl, rendererHtmlPath, devServerUrl)) {
    throw new Error('Untrusted IPC sender')
  }
}

export function createGuardedIpcMain(
  ipcMain: IpcMainLike,
  validateEvent: (event: unknown) => void
): IpcMainLike {
  return {
    handle(channel, listener) {
      ipcMain.handle(channel, (event, ...args) => {
        validateEvent(event)
        return listener(event, ...args)
      })
    }
  }
}

export function applySessionSecurity(targetSession: Session): void {
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  targetSession.setPermissionCheckHandler(() => false)
}

export function applyWindowSecurity(window: BrowserWindow, options: RendererSecurityOptions): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererUrl(targetUrl, options.rendererHtmlPath, options.devServerUrl)) {
      event.preventDefault()
    }
  })
}
