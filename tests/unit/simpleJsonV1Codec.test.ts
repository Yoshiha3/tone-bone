import { describe, expect, it } from 'vitest'
import { type CodecRegistry, createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { SimpleJsonV1Codec } from '@codecs/SimpleJsonV1Codec'
import type { ProjectCodec } from '@codecs/types'
import { createDemoProject } from '@core/demoProject'
import type { Project } from '@core/types'

describe('SimpleJsonV1Codec & CodecRegistry', () => {
  it('round-trips a project losslessly with readable indented JSON', () => {
    const codec = new SimpleJsonV1Codec()
    const project = createDemoProject()

    const encoded = codec.encode(project)
    expect(encoded).toContain('"format": "tone-bone/v1"')
    expect(encoded).toContain('\n  "title": "Simple Sketch"')
    expect(codec.canDecode(encoded)).toBe(true)

    const decoded = codec.decode(encoded)
    expect(decoded).toEqual(project)
  })

  it('rejects malformed or unsupported payloads', () => {
    const codec = new SimpleJsonV1Codec()
    expect(codec.canDecode('not json')).toBe(false)
    expect(codec.canDecode('{"format":"other/v9"}')).toBe(false)
    expect(() => codec.decode('{"format":"other/v9"}')).toThrow()
  })

  it('supports swapping/adding custom codecs via CodecRegistry', () => {
    const registry: CodecRegistry = createDefaultCodecRegistry()
    const customCodec: ProjectCodec = {
      id: 'custom-v2',
      label: 'Custom v2',
      extensions: ['tb2'],
      canDecode: (raw) => raw.startsWith('CUSTOM_V2:'),
      encode: (p) => `CUSTOM_V2:${JSON.stringify(p)}`,
      decode: (raw) => JSON.parse(raw.slice('CUSTOM_V2:'.length)) as Project
    }
    registry.register(customCodec)

    const demo = createDemoProject()
    const v1Raw = registry.encodeDefault(demo)
    expect(registry.decodeAuto(v1Raw).codecId).toBe('simple-json-v1')

    const v2Raw = customCodec.encode(demo)
    const decodedV2 = registry.decodeAuto(v2Raw)
    expect(decodedV2.codecId).toBe('custom-v2')
    expect(decodedV2.project).toEqual(demo)
  })

  it('derives default extension, all extensions, and dialog file filters dynamically', () => {
    const registry = createDefaultCodecRegistry()
    expect(registry.getDefaultExtension()).toBe('json')
    expect(registry.getAllExtensions()).toEqual(['json'])
    expect(registry.getFileFilters()).toEqual([
      { name: 'Tone Bone Project (.json)', extensions: ['json'] }
    ])

    const v2: ProjectCodec = {
      id: 'v2',
      label: 'Tone Bone v2 (.tb2)',
      extensions: ['.TB2', 'json'],
      canDecode: () => false,
      encode: () => '',
      decode: () => createDemoProject()
    }
    registry.register(v2, true)

    expect(registry.getDefaultExtension()).toBe('tb2')
    expect(registry.getAllExtensions()).toEqual(['json', 'tb2'])
    expect(registry.getFileFilters()).toEqual([
      { name: 'All Supported Projects', extensions: ['json', 'tb2'] },
      { name: 'Tone Bone Project (.json)', extensions: ['json'] },
      { name: 'Tone Bone v2 (.tb2)', extensions: ['tb2', 'json'] }
    ])
  })
})
