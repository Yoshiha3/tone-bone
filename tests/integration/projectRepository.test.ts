import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimpleJsonV1Codec } from '@codecs/SimpleJsonV1Codec'
import { createDemoProject, createEmptyProject } from '@core/demoProject'
import {
  createUniqueProjectFile,
  deleteWorkspaceProjectFile,
  duplicateWorkspaceProjectFile,
  listWorkspaceProjects,
  renameWorkspaceProjectFile
} from '../../src/main/projectRepository'

describe('Workspace Project Repository (Integration)', () => {
  const tempDirs: string[] = []
  const codec = new SimpleJsonV1Codec()

  afterEach(() => {
    for (const d of tempDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('creates unique files, lists valid projects newest-first, and skips invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tonebone-proj-repo-'))
    tempDirs.push(dir)

    const p1 = createUniqueProjectFile(dir, 'Untitled', codec.encode(createEmptyProject()))
    const p2 = createUniqueProjectFile(dir, 'Untitled', codec.encode(createEmptyProject()))
    expect(p1.fileName).toBe('Untitled.json')
    expect(p1.title).toBe('Untitled')
    expect(p2.fileName).toBe('Untitled 2.json')
    expect(p2.title).toBe('Untitled 2')

    // Ensure distinct timestamps so sort order is deterministic
    utimesSync(p1.filePath, new Date(1_700_000_000_000), new Date(1_700_000_000_000))
    utimesSync(p2.filePath, new Date(1_700_000_100_000), new Date(1_700_000_100_000))

    // Non-project JSON and corrupted JSON should be ignored safely
    writeFileSync(join(dir, 'broken.json'), '{not-json', 'utf-8')
    writeFileSync(join(dir, 'other.json'), JSON.stringify({ hello: 'world' }), 'utf-8')

    const listed = listWorkspaceProjects(dir)
    expect(listed.map((p) => p.title)).toEqual(['Untitled 2', 'Untitled'])
  })

  it('renames both JSON title and file name, prevents collisions, and handles case-only rename', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tonebone-proj-rename-'))
    tempDirs.push(dir)

    const a = createUniqueProjectFile(dir, 'morning', codec.encode(createDemoProject()))
    const b = createUniqueProjectFile(dir, 'Night', codec.encode(createEmptyProject()))

    // Collision with another project is rejected without modifying files
    expect(() => renameWorkspaceProjectFile(a.filePath, 'Night')).toThrow(/すでに存在します/)
    expect(existsSync(a.filePath)).toBe(true)
    expect(existsSync(b.filePath)).toBe(true)

    // Case-only rename succeeds cleanly
    const cased = renameWorkspaceProjectFile(a.filePath, 'Morning')
    expect(cased.title).toBe('Morning')
    expect(cased.fileName).toBe('Morning.json')
    expect(JSON.parse(readFileSync(cased.filePath, 'utf-8')).title).toBe('Morning')

    // Standard rename updates both path and JSON title
    const renamed = renameWorkspaceProjectFile(cased.filePath, 'Evening Flow')
    expect(renamed.title).toBe('Evening Flow')
    expect(renamed.fileName).toBe('Evening Flow.json')
    expect(existsSync(renamed.filePath)).toBe(true)
    expect(existsSync(join(dir, 'Morning.json'))).toBe(false)
    expect(JSON.parse(readFileSync(renamed.filePath, 'utf-8')).title).toBe('Evening Flow')
  })

  it('duplicates projects with unique names and deletes via trash handler or unlink fallback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tonebone-proj-dup-del-'))
    tempDirs.push(dir)

    const orig = createUniqueProjectFile(dir, 'Sketch', codec.encode(createDemoProject()))
    const copy1 = duplicateWorkspaceProjectFile(orig.filePath)
    const copy2 = duplicateWorkspaceProjectFile(orig.filePath)

    expect(copy1.title).toBe('Sketch Copy')
    expect(copy1.fileName).toBe('Sketch Copy.json')
    expect(copy2.title).toBe('Sketch Copy 2')
    expect(copy2.fileName).toBe('Sketch Copy 2.json')

    const trashMock = vi.fn(async (p: string) => {
      rmSync(p)
    })
    await deleteWorkspaceProjectFile(copy1.filePath, trashMock)
    expect(trashMock).toHaveBeenCalledWith(copy1.filePath)
    expect(existsSync(copy1.filePath)).toBe(false)

    // Fallback unlink when no trashItem function is passed
    await deleteWorkspaceProjectFile(copy2.filePath)
    expect(existsSync(copy2.filePath)).toBe(false)
  })
})
