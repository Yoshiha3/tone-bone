import { getAudibleTrackIds, ticksToSeconds } from '@core/musicMath'
import { TICKS_PER_BAR, type InstrumentDef, type Project } from '@core/types'
import type { AudioExporter } from '../types'
import { DrumVoice } from '../voices/DrumVoice'
import { SynthVoice } from '../voices/SynthVoice'

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Pure PCM-to-WAV (16-bit signed integer) encoder.
 * Works in Node.js and browsers alike for easy unit testing.
 */
export function encodePcmChannelsToWav(
  channels: readonly Float32Array[],
  sampleRate: number
): Uint8Array {
  const numChannels = channels.length
  if (numChannels === 0) {
    throw new Error('At least one audio channel is required')
  }
  const numFrames = channels[0].length
  const bytesPerSample = 2 // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numFrames * blockAlign

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][frame]))
      const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff)
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Uint8Array(buffer)
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Uint8Array {
  const channels: Float32Array[] = []
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }
  return encodePcmChannelsToWav(channels, audioBuffer.sampleRate)
}

export class WavExporter implements AudioExporter {
  readonly id = 'wav-pcm16'
  readonly extension = 'wav'

  private readonly synthVoice = new SynthVoice()
  private readonly drumVoice = new DrumVoice()

  async export(project: Project, instruments: readonly InstrumentDef[]): Promise<Uint8Array> {
    const sampleRate = 44100
    const totalTicks = project.bars * TICKS_PER_BAR
    // Add 0.8s tail so note releases ring out cleanly
    const durationSec = ticksToSeconds(totalTicks, project.bpm) + 0.8
    const frameCount = Math.ceil(durationSec * sampleRate)

    const offline = new OfflineAudioContext(2, frameCount, sampleRate)
    const masterGain = offline.createGain()
    masterGain.gain.value = 0.85
    masterGain.connect(offline.destination)

    const audibleIds = getAudibleTrackIds(project.tracks)

    for (const track of project.tracks) {
      if (!audibleIds.has(track.id) || track.volume <= 0.001) continue
      const trackGain = offline.createGain()
      trackGain.gain.value = track.volume
      trackGain.connect(masterGain)

      const instrument = instruments.find((i) => i.id === track.instrumentId)
      const voice = track.type === 'drum' ? this.drumVoice : this.synthVoice

      for (const note of track.notes) {
        if (note.startTick >= totalTicks) continue
        const startTime = ticksToSeconds(note.startTick, project.bpm)
        const durationSeconds = Math.max(0.03, ticksToSeconds(note.durationTick, project.bpm))
        voice.trigger({
          context: offline,
          destination: trackGain,
          pitch: note.pitch,
          startTime,
          durationSeconds,
          velocity: note.velocity,
          instrument
        })
      }
    }

    const rendered = await offline.startRendering()
    return encodeAudioBufferToWav(rendered)
  }
}
