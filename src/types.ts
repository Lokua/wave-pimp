export interface AudioFile {
  id: string
  name: string
  edited_name?: string
  object_url: string
  size: number
  type: string
  duration?: number
  sample_rate?: number
  channels?: number
}

export type SpectrogramColorMap = 'viridis' | 'grayscale'

export interface ThemePreferences {
  waveformColor: string
  progressColor: string
  spectrogramColorMap: SpectrogramColorMap
}
