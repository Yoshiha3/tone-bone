import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { basename, dirname, join } from 'path'
import type { ProjectSummary } from '@core/types'

const SUPPORTED_FORMAT = 'tone-bone/v1'

interface RawProjectJson {
  format?: unknown
  title?: unknown
  bpm?: unknown
  bars?: unknown
  tracks?: unknown
  [key: string]: unknown
}

export function sanitizeProjectFileName(rawTitle: string): string {
  const cleaned = rawTitle.trim().replace(/[\\/:*?"<>|]/g, '_')
  return cleaned.length > 0 ? cleaned : 'Untitled'
}

function parseProjectJson(raw: string): RawProjectJson | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const obj = parsed as RawProjectJson
    if (
      obj.format !== SUPPORTED_FORMAT ||
      typeof obj.title !== 'string' ||
      typeof obj.bpm !== 'number' ||
      typeof obj.bars !== 'number' ||
      !Array.isArray(obj.tracks)
    ) {
      return null
    }
    return obj
  } catch {
    return null
  }
}

function buildSummary(filePath: string, parsed: RawProjectJson): ProjectSummary {
  const stat = statSync(filePath)
  return {
    filePath,
    fileName: basename(filePath),
    title: String(parsed.title),
    bpm: Number(parsed.bpm),
    bars: Number(parsed.bars),
    trackCount: Array.isArray(parsed.tracks) ? parsed.tracks.length : 0,
    updatedAtMs: stat.mtimeMs
  }
}

function findAvailableTitleAndPath(
  projectsDir: string,
  baseTitle: string
): { title: string; filePath: string } {
  const trimmedBase = baseTitle.trim() || 'Untitled'
  for (let suffix = 1; suffix < 10000; suffix++) {
    const candidateTitle = suffix === 1 ? trimmedBase : `${trimmedBase} ${suffix}`
    const fileName = `${sanitizeProjectFileName(candidateTitle)}.json`
    const candidatePath = join(projectsDir, fileName)
    if (!existsSync(candidatePath)) {
      return { title: candidateTitle, filePath: candidatePath }
    }
  }
  const fallback = `${trimmedBase} ${Date.now()}`
  return {
    title: fallback,
    filePath: join(projectsDir, `${sanitizeProjectFileName(fallback)}.json`)
  }
}

export function listWorkspaceProjects(projectsDir: string): ProjectSummary[] {
  if (!existsSync(projectsDir)) return []

  const entries = readdirSync(projectsDir, { withFileTypes: true })
  const summaries: ProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue
    const filePath = join(projectsDir, entry.name)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const parsed = parseProjectJson(raw)
      if (!parsed) continue
      summaries.push(buildSummary(filePath, parsed))
    } catch {
      // Skip unreadable files
    }
  }

  return summaries.sort((a, b) => {
    if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs
    return a.title.localeCompare(b.title)
  })
}

export function readWorkspaceProjectFile(filePath: string): { filePath: string; content: string } {
  const content = readFileSync(filePath, 'utf-8')
  return { filePath, content }
}

export function createUniqueProjectFile(
  projectsDir: string,
  baseTitle: string,
  rawContent: string
): ProjectSummary {
  mkdirSync(projectsDir, { recursive: true })
  const { title, filePath } = findAvailableTitleAndPath(projectsDir, baseTitle)
  const parsed = parseProjectJson(rawContent)
  if (!parsed) {
    throw new Error('Invalid project content')
  }

  const finalObj: RawProjectJson = { ...parsed, title }
  writeFileSync(filePath, JSON.stringify(finalObj, null, 2) + '\n', 'utf-8')
  return buildSummary(filePath, finalObj)
}

export function renameWorkspaceProjectFile(filePath: string, newTitle: string): ProjectSummary {
  const trimmed = newTitle.trim()
  if (!trimmed) {
    throw new Error('曲名を入力してください')
  }
  if (!existsSync(filePath)) {
    throw new Error('対象のプロジェクトファイルが見つかりません')
  }

  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseProjectJson(raw)
  if (!parsed) {
    throw new Error('プロジェクトファイルの形式が不正です')
  }

  const dir = dirname(filePath)
  const targetFileName = `${sanitizeProjectFileName(trimmed)}.json`
  const targetPath = join(dir, targetFileName)

  const isSamePath = filePath === targetPath
  const isCaseOnlyRename = !isSamePath && filePath.toLowerCase() === targetPath.toLowerCase()

  if (!isSamePath && !isCaseOnlyRename && existsSync(targetPath)) {
    throw new Error(`同名のプロジェクト「${trimmed}」がすでに存在します`)
  }

  const updatedObj: RawProjectJson = { ...parsed, title: trimmed }
  const serialized = JSON.stringify(updatedObj, null, 2) + '\n'

  if (!isSamePath) {
    renameSync(filePath, targetPath)
  }
  writeFileSync(targetPath, serialized, 'utf-8')
  return buildSummary(targetPath, updatedObj)
}

export function duplicateWorkspaceProjectFile(filePath: string): ProjectSummary {
  if (!existsSync(filePath)) {
    throw new Error('対象のプロジェクトファイルが見つかりません')
  }
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseProjectJson(raw)
  if (!parsed) {
    throw new Error('プロジェクトファイルの形式が不正です')
  }
  const dir = dirname(filePath)
  const baseCopyTitle = `${String(parsed.title).trim() || 'Untitled'} Copy`
  return createUniqueProjectFile(dir, baseCopyTitle, raw)
}

export async function deleteWorkspaceProjectFile(
  filePath: string,
  trashItem?: (path: string) => Promise<void>
): Promise<void> {
  if (!existsSync(filePath)) return
  if (trashItem) {
    try {
      await trashItem(filePath)
      return
    } catch {
      // Fall back to direct unlink if OS trash is unavailable
    }
  }
  unlinkSync(filePath)
}
