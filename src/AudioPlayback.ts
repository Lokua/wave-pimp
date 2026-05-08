export type PlaybackStateSnapshot = {
  isPlaying: boolean
  currentTimeSeconds: number
  startOffsetSeconds: number
  durationSeconds: number
}

type AudioPlaybackOptions = {
  audioContext: AudioContext
  audioBuffer: AudioBuffer
  onStateChange: (state: PlaybackStateSnapshot) => void
}

type PlayOptions = {
  fromSeconds?: number
}

type ReplaceBufferOptions = {
  loopRegion?: LoopRegion | null
  crossfadeSeconds?: number
}

export type LoopRegion = {
  startSeconds: number
  endSeconds: number
}

export default class AudioPlayback {
  private readonly audioContext: AudioContext
  private readonly onStateChange: (state: PlaybackStateSnapshot) => void
  private audioBuffer: AudioBuffer
  private sourceNode: AudioBufferSourceNode | null = null
  private sourceGainNode: GainNode | null = null
  private startOffsetSeconds = 0
  private startTimeSeconds = 0
  private loopRegion: LoopRegion | null = null
  private playbackRate = 1

  public isPlaying = false

  constructor({
    audioContext,
    audioBuffer,
    onStateChange,
  }: AudioPlaybackOptions) {
    this.audioContext = audioContext
    this.audioBuffer = audioBuffer
    this.onStateChange = onStateChange
  }

  setBuffer(audioBuffer: AudioBuffer) {
    this.stop()
    this.audioBuffer = audioBuffer
    this.startOffsetSeconds = 0
  }

  replaceBuffer(
    audioBuffer: AudioBuffer,
    { loopRegion, crossfadeSeconds = 0.01 }: ReplaceBufferOptions = {},
  ) {
    if (loopRegion !== undefined) {
      this.loopRegion = loopRegion
    }

    if (!this.isPlaying || !this.sourceNode || !this.sourceGainNode) {
      this.setBuffer(audioBuffer)
      return
    }

    const oldNode = this.sourceNode
    const oldGain = this.sourceGainNode
    const resumeFromSeconds = this.getCurrentTimeSeconds()
    const wasPlaying = this.isPlaying

    oldNode.onended = null
    this.audioBuffer = audioBuffer
    this.startOffsetSeconds = this.clampTime(resumeFromSeconds)
    if (this.startOffsetSeconds >= this.audioBuffer.duration) {
      this.startOffsetSeconds = 0
    }

    const now = this.audioContext.currentTime
    const fadeSeconds = Math.max(0, crossfadeSeconds)
    const node = this.createSourceNode()
    const gain = this.audioContext.createGain()

    gain.gain.setValueAtTime(fadeSeconds > 0 ? 0 : 1, now)
    if (fadeSeconds > 0) {
      gain.gain.linearRampToValueAtTime(1, now + fadeSeconds)
      oldGain.gain.cancelScheduledValues(now)
      oldGain.gain.setValueAtTime(oldGain.gain.value, now)
      oldGain.gain.linearRampToValueAtTime(0, now + fadeSeconds)
    }

    node.connect(gain)
    gain.connect(this.audioContext.destination)
    node.start(0, this.startOffsetSeconds)

    this.sourceNode = node
    this.sourceGainNode = gain
    this.startTimeSeconds = now
    this.isPlaying = wasPlaying
    this.emitState()

    try {
      oldNode.stop(now + fadeSeconds)
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      try {
        oldNode.disconnect()
        oldGain.disconnect()
      } catch {
        // ignore
      }
    }, Math.ceil(fadeSeconds * 1000) + 16)
  }

  getDurationSeconds(): number {
    return this.audioBuffer.duration
  }

  getCurrentTimeSeconds(): number {
    if (!this.isPlaying || !this.sourceNode) {
      return this.startOffsetSeconds
    }

    const t =
      (this.audioContext.currentTime - this.startTimeSeconds) *
        this.playbackRate +
      this.startOffsetSeconds

    if (this.loopRegion) {
      const { startSeconds, endSeconds } = this.loopRegion
      const span = endSeconds - startSeconds
      if (span > 0 && t >= endSeconds) {
        return startSeconds + ((t - startSeconds) % span)
      }
      return Math.max(0, t)
    }

    const d = this.audioBuffer.duration
    return Math.max(0, Math.min(t, d))
  }

  getCurrentSample(sampleRate: number): number {
    const t = this.getCurrentTimeSeconds()
    return Math.floor(t * sampleRate)
  }

  async play({ fromSeconds }: PlayOptions = {}) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    if (typeof fromSeconds === 'number') {
      this.startOffsetSeconds = this.clampTime(fromSeconds)
    } else {
      this.startOffsetSeconds = this.clampTime(this.startOffsetSeconds)
    }

    if (this.startOffsetSeconds >= this.audioBuffer.duration) {
      this.startOffsetSeconds = 0
    }

    this.stopSourceNodeOnly()

    const node = this.createSourceNode()
    const gain = this.audioContext.createGain()
    node.connect(gain)
    gain.connect(this.audioContext.destination)

    node.start(0, this.startOffsetSeconds)
    this.sourceNode = node
    this.sourceGainNode = gain
    this.startTimeSeconds = this.audioContext.currentTime
    this.isPlaying = true
    this.emitState()
  }

  pause() {
    if (!this.isPlaying) return

    const played =
      (this.audioContext.currentTime - this.startTimeSeconds) *
      this.playbackRate
    this.startOffsetSeconds = this.clampTime(this.startOffsetSeconds + played)

    this.stopSourceNodeOnly()
    this.isPlaying = false
    this.emitState()
  }

  stop() {
    this.stopSourceNodeOnly()
    this.isPlaying = false
    this.startOffsetSeconds = 0
    this.emitState()
  }

  seek(seconds: number) {
    const next = this.clampTime(seconds)
    const wasPlaying = this.isPlaying

    this.startOffsetSeconds = next

    if (wasPlaying) {
      void this.play({ fromSeconds: next })
    } else {
      this.emitState()
    }
  }

  togglePlayPause() {
    if (this.isPlaying) this.pause()
    else void this.play()
  }

  setLoopRegion(region: LoopRegion | null) {
    this.loopRegion = region

    if (!this.isPlaying) return

    const resumeFromSeconds = this.getCurrentTimeSeconds()
    void this.play({ fromSeconds: resumeFromSeconds })
  }

  setPlaybackRate(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) return

    this.playbackRate = rate

    if (!this.sourceNode) return
    this.sourceNode.playbackRate.value = rate
  }

  private stopSourceNodeOnly() {
    if (!this.sourceNode) return

    try {
      this.sourceNode.onended = null
      this.sourceNode.stop()
      this.sourceNode.disconnect()
      this.sourceGainNode?.disconnect()
    } catch {
      // ignore
    }

    this.sourceNode = null
    this.sourceGainNode = null
  }

  private createSourceNode() {
    const node = this.audioContext.createBufferSource()
    node.buffer = this.audioBuffer
    node.playbackRate.value = this.playbackRate

    if (this.loopRegion) {
      const { startSeconds, endSeconds } = this.loopRegion
      const clampedStart = this.clampTime(startSeconds)
      const clampedEnd = this.clampTime(endSeconds)
      if (clampedEnd > clampedStart) {
        node.loop = true
        node.loopStart = clampedStart
        node.loopEnd = clampedEnd
      }
    }

    node.onended = () => {
      if (!this.isPlaying) return
      this.isPlaying = false
      this.startOffsetSeconds = 0
      this.sourceNode = null
      this.sourceGainNode = null
      this.emitState()
    }

    return node
  }

  private clampTime(seconds: number): number {
    return Math.max(0, Math.min(seconds, this.audioBuffer.duration))
  }

  private emitState() {
    if (!this.onStateChange) return
    this.onStateChange({
      isPlaying: this.isPlaying,
      currentTimeSeconds: this.getCurrentTimeSeconds(),
      startOffsetSeconds: this.startOffsetSeconds,
      durationSeconds: this.getDurationSeconds(),
    })
  }
}
