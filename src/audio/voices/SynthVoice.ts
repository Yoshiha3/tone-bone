import { midiToFrequency } from '@core/musicMath'
import type { SynthParams } from '@core/types'
import type { AudioVoice, VoiceTriggerParams } from '../types'

const DEFAULT_SYNTH: SynthParams = {
  waveform: 'sine',
  attack: 0.01,
  decay: 0.15,
  sustain: 0.55,
  release: 0.2,
  gainScale: 0.85
}

export class SynthVoice implements AudioVoice {
  readonly type = 'synth' as const

  trigger(params: VoiceTriggerParams): void {
    const { context, destination, pitch, startTime, durationSeconds, velocity, instrument } = params
    const cfg = instrument?.synth ?? DEFAULT_SYNTH

    const osc = context.createOscillator()
    osc.type = cfg.waveform
    osc.frequency.setValueAtTime(midiToFrequency(pitch), startTime)
    if (cfg.detuneCents) {
      osc.detune.setValueAtTime(cfg.detuneCents, startTime)
    }

    const env = context.createGain()
    const peakGain = Math.max(0.001, velocity * (cfg.gainScale ?? 0.8) * 0.35)
    const sustainGain = Math.max(0.0005, peakGain * cfg.sustain)

    const attackEnd = startTime + Math.max(0.002, cfg.attack)
    const decayEnd = attackEnd + Math.max(0.005, cfg.decay)
    const noteOffTime = Math.max(attackEnd, startTime + durationSeconds)
    const releaseEnd = noteOffTime + Math.max(0.01, cfg.release)

    env.gain.setValueAtTime(0.0001, startTime)
    env.gain.linearRampToValueAtTime(peakGain, attackEnd)
    if (decayEnd < noteOffTime) {
      env.gain.exponentialRampToValueAtTime(sustainGain, decayEnd)
      env.gain.setValueAtTime(sustainGain, noteOffTime)
    } else {
      env.gain.exponentialRampToValueAtTime(sustainGain, noteOffTime)
    }
    env.gain.exponentialRampToValueAtTime(0.0001, releaseEnd)

    if (cfg.filterCutoff && cfg.filterCutoff > 0) {
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(cfg.filterCutoff, startTime)
      osc.connect(filter)
      filter.connect(env)
    } else {
      osc.connect(env)
    }

    env.connect(destination)
    osc.start(startTime)
    osc.stop(releaseEnd + 0.02)
  }
}
