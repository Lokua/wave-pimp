export interface AudioFile {
  id: string
  name: string
  size: number
  type: string
  duration: number
  sampleRate: number
  bitDepth: number
  channels: number
  // Do we need both?
  buffer: ArrayBuffer
  audioBuffer: AudioBuffer
}
