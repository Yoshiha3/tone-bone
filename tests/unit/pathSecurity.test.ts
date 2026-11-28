import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ApprovedPathStore,
  assertWorkspaceProjectFilePath,
  isPathInsideDirectory,
  isWorkspaceFolderTarget,
  sanitizeDialogFileName,
  sanitizeExtension,
  sanitizeFileNameSegment
} from '../../src/main/pathSecurity'

describe('Path Security Helpers', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('detects paths inside a base directory and rejects traversal or symlink escapes', () => {
    const root = mkdtempSync(join(tmpdir(), 'onkai-pathsec-'))
    tempDirs.push(root)
    const projectsDir = join(root, 'projects')
    const outsideDir = join(root, 'outside')
    mkdirSync(projectsDir, { recursive: true })
    mkdirSync(outsideDir, { recursive: true })

    const insideFile = join(projectsDir, 'song.json')
    const outsideFile = join(outsideDir, 'secret.json')
    writeFileSync(insideFile, '{}', 'utf-8')
    writeFileSync(outsideFile, '{}', 'utf-8')

    expect(isPathInsideDirectory(projectsDir, insideFile)).toBe(true)
    expect(isPathInsideDirectory(projectsDir, join(projectsDir, 'nested', 'new.json'))).toBe(true)

    // Directory itself, traversal, null byte, and sibling prefix lookalikes must be rejected
    expect(isPathInsideDirectory(projectsDir, projectsDir)).toBe(false)
    expect(
      isPathInsideDirectory(projectsDir, join(projectsDir, '..', 'outside', 'secret.json'))
    ).toBe(false)
    expect(isPathInsideDirectory(projectsDir, join(root, 'projects-evil', 'song.json'))).toBe(false)
    expect(isPathInsideDirectory(projectsDir, `${insideFile}\0.json`)).toBe(false)

    // Symlink pointing outside must be rejected
    const escapeLink = join(projectsDir, 'escape.json')
    symlinkSync(outsideFile, escapeLink)
    expect(isPathInsideDirectory(projectsDir, escapeLink)).toBe(false)
    expect(() => assertWorkspaceProjectFilePath(projectsDir, escapeLink, ['json'])).toThrow()

    // Even a symlink pointing inside should be rejected by assertWorkspaceProjectFilePath
    const internalLink = join(projectsDir, 'alias.json')
    symlinkSync(insideFile, internalLink)
    expect(() => assertWorkspaceProjectFilePath(projectsDir, internalLink, ['json'])).toThrow(
      /シンボリックリンク/
    )
  })

  it('enforces allowed extensions for workspace project paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'onkai-extsec-'))
    tempDirs.push(root)
    const projectsDir = join(root, 'projects')
    mkdirSync(projectsDir, { recursive: true })

    const jsonFile = join(projectsDir, 'ok.json')
    const shFile = join(projectsDir, 'script.sh')
    writeFileSync(jsonFile, '{}', 'utf-8')
    writeFileSync(shFile, 'echo hi', 'utf-8')

    expect(assertWorkspaceProjectFilePath(projectsDir, jsonFile, ['json'])).toBe(jsonFile)
    expect(() => assertWorkspaceProjectFilePath(projectsDir, shFile, ['json'])).toThrow(
      /許可されていないファイル形式/
    )
  })

  it('sanitizes file names, dialog suggestions, and extensions across platforms', () => {
    expect(sanitizeFileNameSegment('  My:Track/1?  ')).toBe('My_Track_1_')
    expect(sanitizeFileNameSegment('...')).toBe('Untitled')
    expect(sanitizeFileNameSegment('..')).toBe('Untitled')
    expect(sanitizeFileNameSegment('CON')).toBe('_CON')
    expect(sanitizeFileNameSegment('nul.json')).toBe('_nul.json')
    expect(sanitizeFileNameSegment('song\x00name.. ')).toBe('songname')

    expect(sanitizeDialogFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeDialogFileName('..\\..\\evil.json')).toBe('evil.json')
    expect(sanitizeDialogFileName('..', 'fallback.json')).toBe('fallback.json')

    expect(sanitizeExtension('.WAV')).toBe('wav')
    expect(sanitizeExtension('mp3')).toBe('mp3')
    expect(() => sanitizeExtension('../wav')).toThrow()
    expect(() => sanitizeExtension('')).toThrow()
  })

  it('validates workspace folder targets and tracks dialog-approved paths', () => {
    expect(isWorkspaceFolderTarget('projects')).toBe(true)
    expect(isWorkspaceFolderTarget('sounds')).toBe(true)
    expect(isWorkspaceFolderTarget('other')).toBe(false)
    expect(isWorkspaceFolderTarget('../')).toBe(false)

    const root = mkdtempSync(join(tmpdir(), 'onkai-approved-'))
    tempDirs.push(root)
    const externalFile = join(root, 'external.json')
    const newWs = join(root, 'alt-workspace')
    writeFileSync(externalFile, '{}', 'utf-8')
    mkdirSync(newWs, { recursive: true })

    const store = new ApprovedPathStore()
    expect(store.isApprovedProjectFile(externalFile)).toBe(false)
    store.approveProjectFile(externalFile)
    expect(store.isApprovedProjectFile(externalFile)).toBe(true)

    expect(store.isApprovedWorkspaceDir(newWs)).toBe(false)
    store.approveWorkspaceDir(newWs)
    expect(store.isApprovedWorkspaceDir(newWs)).toBe(true)
  })
})
