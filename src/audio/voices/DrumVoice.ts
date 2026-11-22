import type { AudioVoice, VoiceTriggerParams } from '../types'

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
      cached = createNoiseBuffer(context, 0.5)
      this.noiseCache.set(context, cached)
    }
    return cached
  }

  trigger(params: VoiceTriggerParams): void {
    const { context, destination, pitch, startTime, velocity } = params
    const gain = Math.max(0.05, Math.min(1, velocity)) * 0.6

    switch (pitch) {
      case 0:
        this.triggerKick(context, destination, startTime, gain)
        break
      case 1:
        this.triggerSnare(context, destination, startTime, gain)
        break
      case 2:
        this.triggerHiHat(context, destination, startTime, gain * 0.65, 0.06)
        break
      case 3:
        this.triggerHiHat(context, destination, startTime, gain * 0.65, 0.28)
        break
      case 4:
        this.triggerClap(context, destination, startTime, gain * 0.75)
        break
      case 5:
        this.triggerRim(context, destination, startTime, gain * 0.7)
        break
      case 6:
        this.triggerTom(context, destination, startTime, gain * 0.85, 115, 58)
        break
      case 7:
        this.triggerTom(context, destination, startTime, gain * 0.85, 185, 95)
        break
      default:
        this.triggerKick(context, destination, startTime, gain * 0.6)
        break
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
}
