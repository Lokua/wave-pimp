export interface AudioFile {
  id: string
  name: string
  filePath?: string
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

export const SAMPLE_RATES = [
  8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 192000,
] as const

export const BIT_DEPTHS = [8, 16, 24, 32] as const

export type Settings = {
  sampleRate: (typeof SAMPLE_RATES)[number]
  bitDepth: (typeof BIT_DEPTHS)[number]
}
