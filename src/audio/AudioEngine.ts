import { secondsToTicks, ticksToSeconds } from '@core/musicMath'
import { TICKS_PER_BAR, type InstrumentDef, type Project, type Track } from '@core/types'
import { collectScheduledNotes } from './scheduler'
import type { NoteTriggerEvent } from './types'
import { DrumVoice } from './voices/DrumVoice'
import { SynthVoice } from './voices/SynthVoice'

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_SEC = 0.12

export class AudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private readonly synthVoice = new SynthVoice()
  private readonly drumVoice = new DrumVoice()

  private isPlaying = false
  private timerId: ReturnType<typeof setInterval> | null = null

  /** Monotonic absolute ticks (never wrap backward while playing) */
  private currentAbsTick = 0
  private lastTickUpdateTime = 0
  private scheduledUntilAbsTick = 0

  private getProject: () => Project
  private getInstruments: () => readonly InstrumentDef[]
  private listeners = new Set<(event: NoteTriggerEvent) => void>()

  constructor(
    getProject: () => Project,
    getInstruments: () => readonly InstrumentDef[]
  ) {
    this.getProject = getProject
    this.getInstruments = getInstruments
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      const AudioCtx = window.AudioContext
      this.context = new AudioCtx()
      this.masterGain = this.context.createGain()
      this.masterGain.gain.value = 0.85

      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyser.smoothingTimeConstant = 0.82

      this.masterGain.connect(this.analyser)
      this.analyser.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') {
      void this.context.resume()
    }
    return this.context
  }

  onNoteTrigger(listener: (event: NoteTriggerEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getWaveformData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false
    this.analyser.getByteTimeDomainData(target)
    return true
  }

  getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false
    this.analyser.getByteFrequencyData(target)
    return true
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getCurrentTick(): number {
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    if (totalTicks <= 0) return 0

    let absTick = this.currentAbsTick
    if (this.isPlaying && this.context) {
      const elapsedSec = Math.max(0, this.context.currentTime - this.lastTickUpdateTime)
      absTick += secondsToTicks(elapsedSec, project.bpm)
    }

    if (project.loopEnabled) {
      return ((absTick % totalTicks) + totalTicks) % totalTicks
    }
    return Math.min(totalTicks, absTick)
  }

  seek(tick: number): void {
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    const clamped = Math.max(0, Math.min(totalTicks, tick))
    this.currentAbsTick = clamped
    this.scheduledUntilAbsTick = clamped
    if (this.context) {
      this.lastTickUpdateTime = this.context.currentTime
    }
  }

  play(): void {
    if (this.isPlaying) return
    const ctx = this.ensureContext()
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    if (totalTicks > 0) {
      if (project.loopEnabled) {
        this.currentAbsTick = ((this.currentAbsTick % totalTicks) + totalTicks) % totalTicks
      } else if (this.currentAbsTick >= totalTicks) {
        this.currentAbsTick = 0
      }
    }
    this.lastTickUpdateTime = ctx.currentTime
    this.scheduledUntilAbsTick = this.currentAbsTick
    this.isPlaying = true

    this.scheduleLoop()
    this.timerId = setInterval(() => this.scheduleLoop(), LOOKAHEAD_MS)
  }

  pause(): void {
    if (!this.isPlaying) return
    this.currentAbsTick = this.getCurrentTick()
    this.scheduledUntilAbsTick = this.currentAbsTick
    this.isPlaying = false
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  stop(): void {
    this.pause()
    this.currentAbsTick = 0
    this.scheduledUntilAbsTick = 0
  }

  previewNote(track: Track, pitch: number, durationSeconds = 0.22): void {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const trackGain = ctx.createGain()
    trackGain.gain.value = track.volume
    trackGain.connect(this.masterGain)

    const instrument = this.getInstruments().find((i) => i.id === track.instrumentId)
    const now = ctx.currentTime + 0.005
    if (track.type === 'drum') {
      this.drumVoice.trigger({
        context: ctx,
        destination: trackGain,
        pitch,
        startTime: now,
        durationSeconds,
        velocity: 0.85,
        instrument
      })
    } else {
      this.synthVoice.trigger({
        context: ctx,
        destination: trackGain,
        pitch,
        startTime: now,
        durationSeconds,
        velocity: 0.8,
        instrument
      })
    }
  }

  private scheduleLoop(): void {
    if (!this.isPlaying || !this.context || !this.masterGain) return
    const ctx = this.context
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    if (totalTicks <= 0) return

    const now = ctx.currentTime
    const elapsedSec = Math.max(0, now - this.lastTickUpdateTime)
    const playheadAbsTick = this.currentAbsTick + secondsToTicks(elapsedSec, project.bpm)

    if (!project.loopEnabled && playheadAbsTick >= totalTicks) {
      this.stop()
      return
    }

    this.currentAbsTick = playheadAbsTick
    this.lastTickUpdateTime = now

    const lookaheadTicks = secondsToTicks(SCHEDULE_AHEAD_SEC, project.bpm)
    const windowStartAbs = Math.max(this.scheduledUntilAbsTick, playheadAbsTick)
    const windowEndAbs = playheadAbsTick + lookaheadTicks

    if (windowEndAbs <= windowStartAbs) return

    const scheduled = collectScheduledNotes(project, windowStartAbs, windowEndAbs)
    const instruments = this.getInstruments()

    for (const item of scheduled) {
      const deltaTicks = item.absTick - playheadAbsTick
      const startTime = Math.max(now, now + ticksToSeconds(deltaTicks, project.bpm))
      const durationSeconds = Math.max(0.03, ticksToSeconds(item.note.durationTick, project.bpm))

      const trackGain = ctx.createGain()
      trackGain.gain.value = item.track.volume
      trackGain.connect(this.masterGain)

      const instrument = instruments.find((i) => i.id === item.track.instrumentId)
      const voice = item.track.type === 'drum' ? this.drumVoice : this.synthVoice
      voice.trigger({
        context: ctx,
        destination: trackGain,
        pitch: item.note.pitch,
        startTime,
        durationSeconds,
        velocity: item.note.velocity,
        instrument
      })

      const evt: NoteTriggerEvent = {
        trackId: item.track.id,
        colorIndex: item.track.colorIndex,
        note: item.note,
        scheduledTime: startTime
      }
      for (const listener of this.listeners) {
        listener(evt)
      }
    }

    this.scheduledUntilAbsTick = windowEndAbs
  }

  dispose(): void {
    this.stop()
    if (this.context) {
      void this.context.close()
      this.context = null
      this.masterGain = null
      this.analyser = null
    }
  }
}
