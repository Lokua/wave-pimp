import { useRef, useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
import type { AudioFile, ThemePreferences } from './types'

interface DetailViewProps {
  file: AudioFile
  theme: ThemePreferences
  onClose: () => void
}

export default function DetailView({ file, theme, onClose }: DetailViewProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const spectrogramRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (!waveformRef.current || !spectrogramRef.current) return

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      url: file.object_url,
      height: 200,
      waveColor: theme.waveformColor,
      progressColor: theme.progressColor,
      cursorWidth: 2,
      cursorColor: theme.progressColor,
      interact: true,
      splitChannels: [
        {
          waveColor: theme.waveformColor,
          progressColor: theme.progressColor,
        },
        {
          waveColor: theme.waveformColor,
          progressColor: theme.progressColor,
        },
      ],
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('timeupdate', (time) => setCurrentTime(time))

    ws.on('ready', () => {
      if (spectrogramRef.current) {
        const spectrogramPlugin = Spectrogram.create({
          container: spectrogramRef.current,
          height: 200,
          labels: true,
        })
        ws.registerPlugin(spectrogramPlugin)
      }
    })

    wavesurferRef.current = ws

    return () => {
      ws.destroy()
    }
  }, [file.object_url])

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const displayName = file.edited_name || file.name

  return (
    <div className="detail-view">
      <div className="detail-view-header">
        <div className="detail-view-title">
          {displayName}
          {file.edited_name && '*'}
        </div>
        <button className="detail-view-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="detail-view-waveform" ref={waveformRef} />
      <div className="detail-view-spectrogram" ref={spectrogramRef} />

      <div className="detail-view-controls">
        <button className="transport-button" onClick={handlePlayPause}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="transport-time">
          {formatTime(currentTime || 0)} / {formatTime(file.duration || 0)}
        </div>
      </div>
    </div>
  )
}
