import { MAX_BARS, PPQN, type Note, type Project, type Track } from '@core/types'
import type { ProjectCodec } from './types'

const FORMAT_ID = 'onkai/v1'
const LEGACY_FORMAT_ID = 'tone-bone/v1'
const SUPPORTED_FORMAT_IDS: ReadonlySet<string> = new Set([FORMAT_ID, LEGACY_FORMAT_ID])

function isSupportedFormat(format: unknown): boolean {
  return typeof format === 'string' && SUPPORTED_FORMAT_IDS.has(format)
}

interface SerializedProjectV1 {
  format: typeof FORMAT_ID
  ppqn: number
  title: string
  bpm: number
  bars: number
  loopEnabled: boolean
  tracks: Track[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function validateNote(raw: unknown, index: number): Note {
  if (!isObject(raw)) {
    throw new Error(`Invalid note at index ${index}`)
  }
  const { id, pitch, startTick, durationTick, velocity } = raw
  if (
    typeof id !== 'string' ||
    typeof pitch !== 'number' ||
    typeof startTick !== 'number' ||
    typeof durationTick !== 'number'
  ) {
    throw new Error(`Invalid note fields at index ${index}`)
  }
  return {
    id,
    pitch,
    startTick: Math.max(0, Math.round(startTick)),
    durationTick: Math.max(1, Math.round(durationTick)),
    velocity: typeof velocity === 'number' ? Math.max(0, Math.min(1, velocity)) : 0.8
  }
}

function validateTrack(raw: unknown, index: number): Track {
  if (!isObject(raw)) {
    throw new Error(`Invalid track at index ${index}`)
  }
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    (raw.type !== 'synth' && raw.type !== 'drum') ||
    typeof raw.instrumentId !== 'string' ||
    !Array.isArray(raw.notes)
  ) {
    throw new Error(`Invalid track fields at index ${index}`)
  }
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    instrumentId: raw.instrumentId,
    colorIndex: typeof raw.colorIndex === 'number' ? raw.colorIndex : index % 6,
    volume: typeof raw.volume === 'number' ? Math.max(0, Math.min(1, raw.volume)) : 0.8,
    muted: Boolean(raw.muted),
    solo: Boolean(raw.solo),
    notes: raw.notes.map((n, i) => validateNote(n, i))
  }
}

export class SimpleJsonV1Codec implements ProjectCodec {
  readonly id = 'simple-json-v1'
  readonly label = 'Onkai Project (.json)'
  readonly extensions = ['json'] as const

  canDecode(raw: string): boolean {
    try {
      const parsed: unknown = JSON.parse(raw)
      return isObject(parsed) && isSupportedFormat(parsed.format)
    } catch {
      return false
    }
  }

  encode(project: Project): string {
    const payload: SerializedProjectV1 = {
      format: FORMAT_ID,
      ppqn: PPQN,
      title: project.title,
      bpm: project.bpm,
      bars: project.bars,
      loopEnabled: project.loopEnabled,
      tracks: project.tracks
    }
    return `${JSON.stringify(payload, null, 2)}\n`
  }

  decode(raw: string): Project {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Project file is not valid JSON')
    }

    if (!isObject(parsed) || !isSupportedFormat(parsed.format)) {
      throw new Error(`Unsupported project format (expected ${FORMAT_ID})`)
    }
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.bpm !== 'number' ||
      typeof parsed.bars !== 'number' ||
      !Array.isArray(parsed.tracks)
    ) {
      throw new Error('Project file is missing required fields')
    }

    return {
      title: parsed.title,
      bpm: Math.max(40, Math.min(300, parsed.bpm)),
      bars: Math.max(1, Math.min(MAX_BARS, Math.round(parsed.bars))),
      loopEnabled: typeof parsed.loopEnabled === 'boolean' ? parsed.loopEnabled : true,
      tracks: parsed.tracks.map((t, i) => validateTrack(t, i))
    }
  }
}
