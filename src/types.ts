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

export type PeaksCacheLevel = {
  blockSize: number
  mins: Float32Array
  maxs: Float32Array
}

export type PeaksCacheChannel = Array<PeaksCacheLevel>
export type PeaksCache = Array<PeaksCacheChannel>

export type VisiblePeaks = {
  visibleMinPerChannel: Array<Float32Array>
  visibleMaxPerChannel: Array<Float32Array>
}

export type SelectionRange = {
  startSample: number | null
  endSample: number | null
}
