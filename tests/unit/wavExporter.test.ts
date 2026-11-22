import { describe, expect, it } from 'vitest'
import { encodePcmChannelsToWav } from '@audio/exporters/WavExporter'

describe('encodePcmChannelsToWav', () => {
  it('writes a valid 16-bit stereo PCM WAV header and non-silent audio payload', () => {
    const sampleRate = 44100
    const numFrames = 4410 // 0.1s
    const left = new Float32Array(numFrames)
    const right = new Float32Array(numFrames)

    for (let i = 0; i < numFrames; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
      left[i] = sample
      right[i] = sample
    }

    const wav = encodePcmChannelsToWav([left, right], sampleRate)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

    const riff = String.fromCharCode(wav[0], wav[1], wav[2], wav[3])
    const wave = String.fromCharCode(wav[8], wav[9], wav[10], wav[11])
    const fmt = String.fromCharCode(wav[12], wav[13], wav[14], wav[15])
    const data = String.fromCharCode(wav[36], wav[37], wav[38], wav[39])

    expect(riff).toBe('RIFF')
    expect(wave).toBe('WAVE')
    expect(fmt).toBe('fmt ')
    expect(data).toBe('data')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(2) // Stereo
    expect(view.getUint32(24, true)).toBe(sampleRate)
    expect(view.getUint16(34, true)).toBe(16) // 16-bit
    expect(view.getUint32(40, true)).toBe(numFrames * 2 * 2)
    expect(wav.byteLength).toBe(44 + numFrames * 4)

    // Verify signal is non-silent and within 16-bit bounds
    let maxAbs = 0
    for (let i = 44; i < wav.byteLength; i += 2) {
      const val = Math.abs(view.getInt16(i, true))
      if (val > maxAbs) maxAbs = val
    }
    expect(maxAbs).toBeGreaterThan(10000)
    expect(maxAbs).toBeLessThanOrEqual(32767)
  })
})
