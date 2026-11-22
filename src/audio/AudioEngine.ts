import { getAudibleTrackIds, secondsToTicks, ticksToSeconds } from '@core/musicMath'
import { TICKS_PER_BAR, type InstrumentDef, type Project, type Track } from '@core/types'
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

  private currentTick = 0
  private lastTickUpdateTime = 0
  private scheduledUntilTick = 0

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
    if (!this.isPlaying || !this.context) {
      return this.currentTick
    }
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    const elapsedSec = Math.max(0, this.context.currentTime - this.lastTickUpdateTime)
    const nextTick = this.currentTick + secondsToTicks(elapsedSec, project.bpm)

    if (project.loopEnabled && totalTicks > 0) {
      return nextTick % totalTicks
    }
    return Math.min(totalTicks, nextTick)
  }

  seek(tick: number): void {
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    this.currentTick = Math.max(0, Math.min(totalTicks, tick))
    this.scheduledUntilTick = this.currentTick
    if (this.context) {
      this.lastTickUpdateTime = this.context.currentTime
    }
  }

  play(): void {
    if (this.isPlaying) return
    const ctx = this.ensureContext()
    const project = this.getProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    if (this.currentTick >= totalTicks) {
      this.currentTick = 0
    }
    this.lastTickUpdateTime = ctx.currentTime
    this.scheduledUntilTick = this.currentTick
    this.isPlaying = true

    this.scheduleLoop()
    this.timerId = setInterval(() => this.scheduleLoop(), LOOKAHEAD_MS)
  }

  pause(): void {
    if (!this.isPlaying) return
    this.currentTick = this.getCurrentTick()
    this.isPlaying = false
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  stop(): void {
    this.pause()
    this.currentTick = 0
    this.scheduledUntilTick = 0
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

    // Advance reference position cleanly (keeps real-time BPM changes glitch-free)
    const now = ctx.currentTime
    const elapsedSec = Math.max(0, now - this.lastTickUpdateTime)
    let playheadTick = this.currentTick + secondsToTicks(elapsedSec, project.bpm)

    if (playheadTick >= totalTicks) {
      if (project.loopEnabled) {
        playheadTick = playheadTick % totalTicks
        this.scheduledUntilTick = this.scheduledUntilTick % totalTicks
      } else {
        this.stop()
        return
      }
    }

    this.currentTick = playheadTick
    this.lastTickUpdateTime = now

    const lookaheadTicks = secondsToTicks(SCHEDULE_AHEAD_SEC, project.bpm)
    const windowStart = this.scheduledUntilTick
    const windowEnd = playheadTick + lookaheadTicks

    this.scheduleTickRange(ctx, project, windowStart, windowEnd, now, playheadTick, totalTicks)
    this.scheduledUntilTick = windowEnd >= totalTicks && project.loopEnabled
      ? windowEnd % totalTicks
      : windowEnd
  }

  private scheduleTickRange(
    ctx: AudioContext,
    project: Project,
    windowStart: number,
    windowEnd: number,
    now: number,
    playheadTick: number,
    totalTicks: number
  ): void {
    const audibleIds = getAudibleTrackIds(project.tracks)
    const instruments = this.getInstruments()

    const scheduleSegment = (segStart: number, segEnd: number, tickOffset: number): void => {
      for (const track of project.tracks) {
        if (!audibleIds.has(track.id) || track.volume <= 0.001) continue
        const instrument = instruments.find((i) => i.id === track.instrumentId)

        for (const note of track.notes) {
          if (note.startTick >= segStart && note.startTick < segEnd) {
            const deltaTicks = note.startTick + tickOffset - playheadTick
            const startTime = Math.max(now, now + ticksToSeconds(deltaTicks, project.bpm))
            const durationSeconds = Math.max(0.03, ticksToSeconds(note.durationTick, project.bpm))

            const trackGain = ctx.createGain()
            trackGain.gain.value = track.volume
            trackGain.connect(this.masterGain!)

            const voice = track.type === 'drum' ? this.drumVoice : this.synthVoice
            voice.trigger({
              context: ctx,
              destination: trackGain,
              pitch: note.pitch,
              startTime,
              durationSeconds,
              velocity: note.velocity,
              instrument
            })

            const evt: NoteTriggerEvent = {
              trackId: track.id,
              colorIndex: track.colorIndex,
              note,
              scheduledTime: startTime
            }
            for (const listener of this.listeners) {
              listener(evt)
            }
          }
        }
      }
    }

    if (windowEnd <= totalTicks) {
      scheduleSegment(windowStart, windowEnd, 0)
    } else if (project.loopEnabled) {
      scheduleSegment(windowStart, totalTicks, 0)
      scheduleSegment(0, windowEnd - totalTicks, totalTicks)
    } else {
      scheduleSegment(windowStart, totalTicks, 0)
    }
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
