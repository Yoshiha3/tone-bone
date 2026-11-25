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
import { basename, dirname, extname, join } from 'path'
import { createDefaultCodecRegistry, type CodecRegistry } from '@codecs/CodecRegistry'
import type { Project, ProjectSummary } from '@core/types'
import { sanitizeFileNameSegment } from './pathSecurity'

const defaultCodecRegistry = createDefaultCodecRegistry()

export function sanitizeProjectFileName(rawTitle: string): string {
  return sanitizeFileNameSegment(rawTitle, 'Untitled')
}

function tryDecodeProject(
  raw: string,
  codecs: CodecRegistry
): { project: Project; codecId: string } | null {
  try {
    return codecs.decodeAuto(raw)
  } catch {
    return null
  }
}

function buildSummary(filePath: string, project: Project): ProjectSummary {
  const stat = statSync(filePath)
  return {
    filePath,
    fileName: basename(filePath),
    title: project.title,
    bpm: project.bpm,
    bars: project.bars,
    trackCount: project.tracks.length,
    updatedAtMs: stat.mtimeMs
  }
}

function findAvailableTitleAndPath(
  projectsDir: string,
  baseTitle: string,
  extension: string
): { title: string; filePath: string } {
  const trimmedBase = baseTitle.trim() || 'Untitled'
  for (let suffix = 1; suffix < 10000; suffix++) {
    const candidateTitle = suffix === 1 ? trimmedBase : `${trimmedBase} ${suffix}`
    const fileName = `${sanitizeProjectFileName(candidateTitle)}.${extension}`
    const candidatePath = join(projectsDir, fileName)
    if (!existsSync(candidatePath)) {
      return { title: candidateTitle, filePath: candidatePath }
    }
  }
  const fallback = `${trimmedBase} ${Date.now()}`
  return {
    title: fallback,
    filePath: join(projectsDir, `${sanitizeProjectFileName(fallback)}.${extension}`)
  }
}

export function listWorkspaceProjects(
  projectsDir: string,
  codecs: CodecRegistry = defaultCodecRegistry
): ProjectSummary[] {
  if (!existsSync(projectsDir)) return []

  const allowedExts = new Set(codecs.getAllExtensions())
  const entries = readdirSync(projectsDir, { withFileTypes: true })
  const summaries: ProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const ext = extname(entry.name).replace(/^\./, '').toLowerCase()
    if (!allowedExts.has(ext)) continue
    const filePath = join(projectsDir, entry.name)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const decoded = tryDecodeProject(raw, codecs)
      if (!decoded) continue
      summaries.push(buildSummary(filePath, decoded.project))
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
  rawContent: string,
  codecs: CodecRegistry = defaultCodecRegistry
): ProjectSummary {
  mkdirSync(projectsDir, { recursive: true })
  const decoded = tryDecodeProject(rawContent, codecs)
  if (!decoded) {
    throw new Error('Invalid project content')
  }

  const codec = codecs.getById(decoded.codecId) ?? codecs.getDefault()
  const ext = codec.extensions[0]?.replace(/^\./, '').toLowerCase() ?? codecs.getDefaultExtension()
  const { title, filePath } = findAvailableTitleAndPath(projectsDir, baseTitle, ext)

  const updatedProject: Project = { ...decoded.project, title }
  writeFileSync(filePath, codec.encode(updatedProject), 'utf-8')
  return buildSummary(filePath, updatedProject)
}

export function renameWorkspaceProjectFile(
  filePath: string,
  newTitle: string,
  codecs: CodecRegistry = defaultCodecRegistry
): ProjectSummary {
  const trimmed = newTitle.trim()
  if (!trimmed) {
    throw new Error('曲名を入力してください')
  }
  if (!existsSync(filePath)) {
    throw new Error('対象のプロジェクトファイルが見つかりません')
  }

  const raw = readFileSync(filePath, 'utf-8')
  const decoded = tryDecodeProject(raw, codecs)
  if (!decoded) {
    throw new Error('プロジェクトファイルの形式が不正です')
  }

  const codec = codecs.getById(decoded.codecId) ?? codecs.getDefault()
  const ext = codec.extensions[0]?.replace(/^\./, '').toLowerCase() ?? codecs.getDefaultExtension()
  const dir = dirname(filePath)
  const targetFileName = `${sanitizeProjectFileName(trimmed)}.${ext}`
  const targetPath = join(dir, targetFileName)

  const isSamePath = filePath === targetPath
  const isCaseOnlyRename = !isSamePath && filePath.toLowerCase() === targetPath.toLowerCase()

  if (!isSamePath && !isCaseOnlyRename && existsSync(targetPath)) {
    throw new Error(`同名のプロジェクト「${trimmed}」がすでに存在します`)
  }

  const updatedProject: Project = { ...decoded.project, title: trimmed }
  const serialized = codec.encode(updatedProject)

  if (!isSamePath) {
    renameSync(filePath, targetPath)
  }
  writeFileSync(targetPath, serialized, 'utf-8')
  return buildSummary(targetPath, updatedProject)
}

export function duplicateWorkspaceProjectFile(
  filePath: string,
  codecs: CodecRegistry = defaultCodecRegistry
): ProjectSummary {
  if (!existsSync(filePath)) {
    throw new Error('対象のプロジェクトファイルが見つかりません')
  }
  const raw = readFileSync(filePath, 'utf-8')
  const decoded = tryDecodeProject(raw, codecs)
  if (!decoded) {
    throw new Error('プロジェクトファイルの形式が不正です')
  }
  const dir = dirname(filePath)
  const baseCopyTitle = `${decoded.project.title.trim() || 'Untitled'} Copy`
  return createUniqueProjectFile(dir, baseCopyTitle, raw, codecs)
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
