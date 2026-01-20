import { useState, useRef, useEffect } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
import type { AudioFile, ThemePreferences } from './types'

interface WaveCardProps {
  file: AudioFile
  theme: ThemePreferences
  isSelected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onRemove: () => void
  onSave: () => void
  onUpdateFilename: (name: string) => void
  onMetadataLoaded: (meta: {
    duration: number
    sample_rate: number
    channels: number
  }) => void
}

export default function WaveCard({
  file,
  theme,
  isSelected,
  onSelect,
  onDoubleClick,
  onRemove,
  onSave,
  onUpdateFilename,
  onMetadataLoaded,
}: WaveCardProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const spectrogramRef = useRef<HTMLDivElement>(null)

  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [editValue, setEditValue] = useState(file.edited_name || file.name)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (!waveformRef.current || !spectrogramRef.current) return

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      url: file.object_url,
      height: 120,
      waveColor: theme.waveformColor,
      progressColor: theme.progressColor,
      cursorWidth: 1,
      cursorColor: theme.progressColor,
      interact: true,
    })

    ws.on('ready', () => {
      const decoded = ws.getDecodedData()
      if (decoded) {
        onMetadataLoaded({
          duration: decoded.duration,
          sample_rate: decoded.sampleRate,
          channels: decoded.numberOfChannels,
        })
      }

      if (spectrogramRef.current) {
        const spectrogramPlugin = Spectrogram.create({
          container: spectrogramRef.current,
          height: 120,
          labels: false,
        })
        ws.registerPlugin(spectrogramPlugin)
      }
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()))
    ws.on('interaction', () => setCurrentTime(ws.getCurrentTime()))

    wavesurferRef.current = ws

    return () => {
      ws.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.object_url])
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const onEditSave = () => {
    if (editValue && editValue !== file.name) {
      onUpdateFilename(editValue)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEditSave()
    }
  }

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatSampleRate = (rate: number | undefined) => {
    if (!rate) return '--'
    return `${(rate / 1000).toFixed(1)}kHz`
  }

  const hasUnsaved = editValue !== file.name

  return (
    <div
      className={`wave-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="wave-card-waveform" ref={waveformRef} />
      <div className="wave-card-spectrogram" ref={spectrogramRef} />

      <div className="wave-card-controls">
        <button
          className="wave-card-transport-button"
          onClick={handlePlayPause}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="wave-card-transport-button"
          onClick={() => {
            if (wavesurferRef.current) {
              wavesurferRef.current.seekTo(0)
              wavesurferRef.current.setTime(0)
              setCurrentTime(0)
            }
          }}
          title="Start Over"
        >
          {'⏮'}
        </button>
        <div className="wave-card-transport-time">
          {formatTime(currentTime || 0)} / {formatTime(file.duration || 0)}
        </div>
      </div>

      <div className="wave-card-info">
        <div className="wave-card-name-row">
          <input
            type="text"
            className="wave-card-name-input"
            value={editValue}
            title={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onEditSave}
            onClick={(e) => e.stopPropagation()}
          />
          {hasUnsaved && '*'}
        </div>

        <div className="wave-card-metadata">
          <span>{formatDuration(file.duration)}</span>
          <span>{formatSampleRate(file.sample_rate)}</span>
          <span>{file.channels ? `${file.channels}ch` : '--'}</span>
        </div>

        <div className="wave-card-actions">
          <button
            className="wave-card-button"
            onClick={onDoubleClick}
            title="Detail View"
          >
            Edit
          </button>
          <button
            className="wave-card-button"
            onClick={onRemove}
            title="Remove (Delete/Cmd+X)"
          >
            Remove
          </button>
          <button
            disabled={!hasUnsaved}
            className="wave-card-button"
            onClick={onSave}
            title="Save (Cmd+S)"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
