import { DRUM_LANES, type DrumLaneId } from '@core/types'
import type { AudioVoice, VoiceTriggerParams } from '../types'

type DrumLaneHandler = (
  context: BaseAudioContext,
  destination: AudioNode,
  time: number,
  gainLevel: number
) => void

const NOISE_BUFFER_DURATION_SEC = 2.4
// Classic 808-style inharmonic metallic frequencies in true crash cymbal register
const CYMBAL_METALLIC_FREQS = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0] as const

const DRUM_LANE_BY_PITCH = new Map<number, DrumLaneId>(
  DRUM_LANES.map((lane) => [lane.pitch, lane.id])
)

function createNoiseBuffer(context: BaseAudioContext, durationSeconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export class DrumVoice implements AudioVoice {
  readonly type = 'drum' as const
  private noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

  private getNoiseBuffer(context: BaseAudioContext): AudioBuffer {
    let cached = this.noiseCache.get(context)
    if (!cached) {
      cached = createNoiseBuffer(context, NOISE_BUFFER_DURATION_SEC)
      this.noiseCache.set(context, cached)
    }
    return cached
  }

  private readonly laneHandlers: Record<DrumLaneId, DrumLaneHandler> = {
    kick: (ctx, dest, time, gain) => this.triggerKick(ctx, dest, time, gain),
    snare: (ctx, dest, time, gain) => this.triggerSnare(ctx, dest, time, gain),
    'hihat-closed': (ctx, dest, time, gain) =>
      this.triggerHiHat(ctx, dest, time, gain * 0.65, 0.06),
    'hihat-open': (ctx, dest, time, gain) => this.triggerHiHat(ctx, dest, time, gain * 0.65, 0.28),
    clap: (ctx, dest, time, gain) => this.triggerClap(ctx, dest, time, gain * 0.75),
    rim: (ctx, dest, time, gain) => this.triggerRim(ctx, dest, time, gain * 0.7),
    'tom-low': (ctx, dest, time, gain) => this.triggerTom(ctx, dest, time, gain * 0.85, 115, 58),
    'tom-high': (ctx, dest, time, gain) => this.triggerTom(ctx, dest, time, gain * 0.85, 185, 95),
    cymbal: (ctx, dest, time, gain) => this.triggerCymbal(ctx, dest, time, gain * 0.95)
  }

  trigger(params: VoiceTriggerParams): void {
    const { context, destination, pitch, startTime, velocity } = params
    const gain = Math.max(0.05, Math.min(1, velocity)) * 0.6
    const laneId = DRUM_LANE_BY_PITCH.get(pitch)
    if (laneId) {
      this.laneHandlers[laneId](context, destination, startTime, gain)
    } else {
      this.triggerKick(context, destination, startTime, gain * 0.6)
    }
  }

  private triggerKick(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number
  ): void {
    const osc = context.createOscillator()
    const env = context.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(145, time)
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11)

    env.gain.setValueAtTime(gainLevel, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.24)

    osc.connect(env)
    env.connect(destination)
    osc.start(time)
    osc.stop(time + 0.26)
  }

  private triggerSnare(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number
  ): void {
    // Noise component
    const noise = context.createBufferSource()
    noise.buffer = this.getNoiseBuffer(context)
    const hp = context.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(1100, time)
    const noiseEnv = context.createGain()
    noiseEnv.gain.setValueAtTime(gainLevel * 0.75, time)
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.16)

    noise.connect(hp)
    hp.connect(noiseEnv)
    noiseEnv.connect(destination)
    noise.start(time)
    noise.stop(time + 0.18)

    // Body tone
    const osc = context.createOscillator()
    const oscEnv = context.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(210, time)
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.08)
    oscEnv.gain.setValueAtTime(gainLevel * 0.55, time)
    oscEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.11)

    osc.connect(oscEnv)
    oscEnv.connect(destination)
    osc.start(time)
    osc.stop(time + 0.12)
  }

  private triggerHiHat(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number,
    decay: number
  ): void {
    const noise = context.createBufferSource()
    noise.buffer = this.getNoiseBuffer(context)
    const hp = context.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(6500, time)
    const env = context.createGain()
    env.gain.setValueAtTime(gainLevel * 0.5, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + decay)

    noise.connect(hp)
    hp.connect(env)
    env.connect(destination)
    noise.start(time)
    noise.stop(time + decay + 0.02)
  }

  private triggerClap(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number
  ): void {
    const offsets = [0, 0.012, 0.024]
    for (const offset of offsets) {
      const noise = context.createBufferSource()
      noise.buffer = this.getNoiseBuffer(context)
      const bp = context.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1600, time + offset)
      bp.Q.setValueAtTime(1.2, time + offset)

      const env = context.createGain()
      env.gain.setValueAtTime(gainLevel * 0.6, time + offset)
      env.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.11)

      noise.connect(bp)
      bp.connect(env)
      env.connect(destination)
      noise.start(time + offset)
      noise.stop(time + offset + 0.13)
    }
  }

  private triggerRim(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number
  ): void {
    const osc = context.createOscillator()
    const env = context.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(840, time)
    osc.frequency.exponentialRampToValueAtTime(420, time + 0.025)
    env.gain.setValueAtTime(gainLevel * 0.6, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.04)

    osc.connect(env)
    env.connect(destination)
    osc.start(time)
    osc.stop(time + 0.05)
  }

  private triggerTom(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number,
    startFreq: number,
    endFreq: number
  ): void {
    const osc = context.createOscillator()
    const env = context.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, time)
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.16)
    env.gain.setValueAtTime(gainLevel * 0.75, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.22)

    osc.connect(env)
    env.connect(destination)
    osc.start(time)
    osc.stop(time + 0.24)
  }

  private triggerCymbal(
    context: BaseAudioContext,
    destination: AudioNode,
    time: number,
    gainLevel: number
  ): void {
    // 1. Clean broadband splash burst for a natural, uncolored crash attack
    const burstNoise = context.createBufferSource()
    burstNoise.buffer = this.getNoiseBuffer(context)

    const burstHp = context.createBiquadFilter()
    burstHp.type = 'highpass'
    burstHp.frequency.setValueAtTime(1200, time)

    const burstLp = context.createBiquadFilter()
    burstLp.type = 'lowpass'
    burstLp.frequency.setValueAtTime(10500, time)

    const burstEnv = context.createGain()
    burstEnv.gain.setValueAtTime(gainLevel * 0.56, time)
    burstEnv.gain.exponentialRampToValueAtTime(gainLevel * 0.12, time + 0.065)
    burstEnv.gain.exponentialRampToValueAtTime(0.0008, time + 0.2)

    burstNoise.connect(burstHp)
    burstHp.connect(burstLp)
    burstLp.connect(burstEnv)
    burstEnv.connect(destination)
    burstNoise.start(time)
    burstNoise.stop(time + 0.22)

    // 2. Open, uncolored crash wash with natural high-frequency decay sweep
    const washNoise = context.createBufferSource()
    washNoise.buffer = this.getNoiseBuffer(context)

    const washHp = context.createBiquadFilter()
    washHp.type = 'highpass'
    washHp.frequency.setValueAtTime(1900, time)

    const washLp = context.createBiquadFilter()
    washLp.type = 'lowpass'
    washLp.frequency.setValueAtTime(12000, time)
    washLp.frequency.exponentialRampToValueAtTime(3800, time + 1.9)

    const washEnv = context.createGain()
    washEnv.gain.setValueAtTime(0.0001, time)
    washEnv.gain.linearRampToValueAtTime(gainLevel * 0.44, time + 0.004)
    washEnv.gain.exponentialRampToValueAtTime(gainLevel * 0.22, time + 0.24)
    washEnv.gain.exponentialRampToValueAtTime(0.0006, time + 1.95)

    washNoise.connect(washHp)
    washHp.connect(washLp)
    washLp.connect(washEnv)
    washEnv.connect(destination)
    washNoise.start(time)
    washNoise.stop(time + 2.02)

    // 3. Subtle metallic shimmer underneath so it reads as cymbal rather than plain noise
    const metalHp = context.createBiquadFilter()
    metalHp.type = 'highpass'
    metalHp.frequency.setValueAtTime(3200, time)

    const metalLp = context.createBiquadFilter()
    metalLp.type = 'lowpass'
    metalLp.frequency.setValueAtTime(9500, time)

    const metalEnv = context.createGain()
    metalEnv.gain.setValueAtTime(0.0001, time)
    metalEnv.gain.linearRampToValueAtTime(gainLevel * 0.08, time + 0.005)
    metalEnv.gain.exponentialRampToValueAtTime(0.0006, time + 1.65)

    metalHp.connect(metalLp)
    metalLp.connect(metalEnv)
    metalEnv.connect(destination)

    for (const freq of CYMBAL_METALLIC_FREQS) {
      const osc = context.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, time)
      osc.connect(metalHp)
      osc.start(time)
      osc.stop(time + 1.72)
    }
  }
}
