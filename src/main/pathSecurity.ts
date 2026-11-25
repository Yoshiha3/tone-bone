import { existsSync, lstatSync, realpathSync } from 'fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path'
import type { WorkspaceFolderTarget } from '@core/types'

const WINDOWS_RESERVED_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g
const INVALID_FILENAME_CHARS_RE = /[\\/:*?"<>|]/g

export const WORKSPACE_FOLDER_TARGETS: readonly WorkspaceFolderTarget[] = [
  'workspace',
  'projects',
  'exports',
  'themes',
  'sounds'
]

export function isWorkspaceFolderTarget(target: unknown): target is WorkspaceFolderTarget {
  return (
    typeof target === 'string' &&
    (WORKSPACE_FOLDER_TARGETS as readonly string[]).includes(target)
  )
}

function toComparablePath(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath
}

function assertValidPathString(rawPath: unknown, message = '不正なファイルパスです'): string {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0 || rawPath.includes('\0')) {
    throw new Error(message)
  }
  return rawPath
}

/**
 * Resolves a path to its real canonical form, including when the leaf file or
 * nested subdirectories do not exist yet (resolving the nearest existing ancestor).
 */
export function normalizeRealPath(targetPath: string): string {
  const valid = assertValidPathString(targetPath)
  let current = resolve(valid)
  const missingSegments: string[] = []

  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) {
      return resolve(valid)
    }
    missingSegments.push(basename(current))
    current = parent
  }

  const realExisting = realpathSync(current)
  return missingSegments.length > 0
    ? join(realExisting, ...missingSegments.reverse())
    : realExisting
}

export function isSameResolvedPath(pathA: string, pathB: string): boolean {
  try {
    return toComparablePath(normalizeRealPath(pathA)) === toComparablePath(normalizeRealPath(pathB))
  } catch {
    return false
  }
}

/**
 * Returns true strictly when `targetPath` resolves inside `baseDir` (not equal
 * to `baseDir` itself, and not escaping via `..` or symlinks).
 */
export function isPathInsideDirectory(baseDir: string, targetPath: string): boolean {
  try {
    const baseReal = toComparablePath(normalizeRealPath(baseDir))
    const targetReal = toComparablePath(normalizeRealPath(targetPath))
    const rel = relative(baseReal, targetReal)
    return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
  } catch {
    return false
  }
}

export function hasAllowedExtension(
  filePath: string,
  allowedExtensions: readonly string[]
): boolean {
  const ext = extname(filePath).replace(/^\./, '').toLowerCase()
  if (!ext) return false
  const allowed = new Set(allowedExtensions.map((e) => e.replace(/^\./, '').toLowerCase()))
  return allowed.has(ext)
}

/**
 * Validates that `filePath` is a non-symlink file inside `projectsDir` with an
 * extension registered in the codec registry.
 */
export function assertWorkspaceProjectFilePath(
  projectsDir: string,
  filePath: unknown,
  allowedExtensions: readonly string[]
): string {
  const valid = assertValidPathString(filePath, 'プロジェクトパスが不正です')
  if (!isPathInsideDirectory(projectsDir, valid)) {
    throw new Error('ワークスペース外のファイルにはアクセスできません')
  }
  if (existsSync(valid) && lstatSync(valid).isSymbolicLink()) {
    throw new Error('シンボリックリンクにはアクセスできません')
  }
  if (!hasAllowedExtension(valid, allowedExtensions)) {
    throw new Error('許可されていないファイル形式です')
  }
  return valid
}

/**
 * Sanitizes a single file-name segment across macOS, Linux, and Windows.
 */
export function sanitizeFileNameSegment(rawName: string, fallback = 'Untitled'): string {
  const stripped = rawName
    .replace(CONTROL_CHARS_RE, '')
    .trim()
    .replace(INVALID_FILENAME_CHARS_RE, '_')
    .replace(/[. ]+$/g, '')

  if (stripped.length === 0 || stripped === '.' || stripped === '..') {
    return fallback
  }
  if (WINDOWS_RESERVED_NAME_RE.test(stripped)) {
    return `_${stripped}`
  }
  return stripped
}

/**
 * Extracts and sanitizes only the leaf file name from a dialog suggestion so
 * callers cannot inject directory traversal segments into `defaultPath`.
 */
export function sanitizeDialogFileName(rawName: string, fallback = 'untitled'): string {
  const normalizedSlashes = typeof rawName === 'string' ? rawName.replace(/\\/g, '/') : ''
  const leaf = basename(normalizedSlashes)
  return sanitizeFileNameSegment(leaf, fallback)
}

export function sanitizeExtension(rawExt: string): string {
  const cleaned = typeof rawExt === 'string' ? rawExt.trim().replace(/^\./, '').toLowerCase() : ''
  if (!/^[a-z0-9]+$/.test(cleaned)) {
    throw new Error('不正なファイル拡張子です')
  }
  return cleaned
}

/**
 * Tracks paths explicitly chosen by the user via native OS dialogs during the
 * current session so Main can permit overwriting external projects or switching
 * workspace folders without trusting arbitrary Renderer-supplied paths.
 */
export class ApprovedPathStore {
  private readonly projectFiles = new Set<string>()
  private readonly workspaceDirs = new Set<string>()

  approveProjectFile(filePath: string): void {
    this.projectFiles.add(toComparablePath(normalizeRealPath(filePath)))
  }

  isApprovedProjectFile(filePath: string): boolean {
    try {
      return this.projectFiles.has(toComparablePath(normalizeRealPath(filePath)))
    } catch {
      return false
    }
  }

  approveWorkspaceDir(dirPath: string): void {
    this.workspaceDirs.add(toComparablePath(normalizeRealPath(dirPath)))
  }

  isApprovedWorkspaceDir(dirPath: string): boolean {
    try {
      return this.workspaceDirs.has(toComparablePath(normalizeRealPath(dirPath)))
    } catch {
      return false
    }
  }
}
