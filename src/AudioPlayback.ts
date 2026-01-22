type PlaybackStateSnapshot = {
  isPlaying: boolean
  currentTimeSeconds: number
  startOffsetSeconds: number
  durationSeconds: number
}

type AudioPlaybackOptions = {
  audioContext?: AudioContext
  onStateChange?: (state: PlaybackStateSnapshot) => void
}

type PlayOptions = {
  fromSeconds?: number
}

export default class AudioPlayback {
  private readonly audioContext: AudioContext
  private readonly onStateChange?: (state: PlaybackStateSnapshot) => void

  private audioBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null

  public isPlaying = false

  private startOffsetSeconds = 0
  private startTimeSeconds = 0

  constructor({ audioContext, onStateChange }: AudioPlaybackOptions = {}) {
    this.audioContext = audioContext
    this.onStateChange = onStateChange
  }

  setBuffer(audioBuffer: AudioBuffer) {
    this.stop()
    this.audioBuffer = audioBuffer
    this.startOffsetSeconds = 0
  }

  getDurationSeconds(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0
  }

  getCurrentTimeSeconds(): number {
    if (!this.audioBuffer) return 0

    if (!this.isPlaying || !this.sourceNode) {
      return this.startOffsetSeconds
    }

    const t =
      this.audioContext.currentTime -
      this.startTimeSeconds +
      this.startOffsetSeconds

    const d = this.audioBuffer.duration
    return Math.max(0, Math.min(t, d))
  }

  getCurrentSample(sampleRate: number): number {
    const t = this.getCurrentTimeSeconds()
    return Math.floor(t * sampleRate)
  }

  async play({ fromSeconds }: PlayOptions = {}) {
    if (!this.audioBuffer) return

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

    const node = this.audioContext.createBufferSource()
    node.buffer = this.audioBuffer
    node.connect(this.audioContext.destination)

    node.onended = () => {
      if (!this.isPlaying) return
      this.isPlaying = false
      this.startOffsetSeconds = 0
      this.sourceNode = null
      this.emitState()
    }

    node.start(0, this.startOffsetSeconds)
    this.sourceNode = node
    this.startTimeSeconds = this.audioContext.currentTime
    this.isPlaying = true
    this.emitState()
  }

  pause() {
    if (!this.audioBuffer) return
    if (!this.isPlaying) return

    const played = this.audioContext.currentTime - this.startTimeSeconds
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
    if (!this.audioBuffer) return

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

  destroy() {
    this.stop()
    void this.audioContext.close()
  }

  private stopSourceNodeOnly() {
    if (!this.sourceNode) return

    try {
      this.sourceNode.onended = null
      this.sourceNode.stop()
      this.sourceNode.disconnect()
    } catch {
      // ignore
    }

    this.sourceNode = null
  }

  private clampTime(seconds: number): number {
    const d = this.audioBuffer ? this.audioBuffer.duration : 0
    return Math.max(0, Math.min(seconds, d))
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
