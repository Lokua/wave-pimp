import { useRef, useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import IconButton from './IconButton'
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
  const regionsPluginRef = useRef<RegionsPlugin | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [activeRegion, setActiveRegion] = useState<{
    start: number
    end: number
  } | null>(null)
  const [waveformHeight, setWaveformHeight] = useState(300)
  const [spectrogramHeight, setSpectrogramHeight] = useState(250)

  useEffect(() => {
    const updateHeights = () => {
      if (waveformRef.current && spectrogramRef.current) {
        setWaveformHeight(waveformRef.current.clientHeight)
        setSpectrogramHeight(spectrogramRef.current.clientHeight)
      }
    }

    updateHeights()
    window.addEventListener('resize', updateHeights)
    return () => window.removeEventListener('resize', updateHeights)
  }, [])

  useEffect(() => {
    if (
      !waveformRef.current ||
      !spectrogramRef.current ||
      waveformHeight === 0 ||
      spectrogramHeight === 0
    )
      return

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      url: file.object_url,
      height: waveformHeight,
      waveColor: theme.waveformColor,
      progressColor: theme.progressColor,
      cursorWidth: 2,
      cursorColor: theme.progressColor,
      interact: true,
    })

    ws.on('ready', () => {
      const decoded = ws.getDecodedData()
      if (!decoded) {
        console.error('No decoded data!')
        return
      }

      if (zoom > 0) {
        ws.zoom(zoom)
      }

      const regionsPlugin = RegionsPlugin.create()
      ws.registerPlugin(regionsPlugin)
      regionsPluginRef.current = regionsPlugin

      regionsPlugin.enableDragSelection({
        color: 'rgba(255, 255, 255, 0.2)',
      })

      regionsPlugin.on('region-updated', (region) => {
        setActiveRegion({ start: region.start, end: region.end })
      })

      regionsPlugin.on('region-created', (region) => {
        const regions = regionsPlugin.getRegions()
        regions.forEach((r) => {
          if (r.id !== region.id) {
            r.remove()
          }
        })
        setActiveRegion({ start: region.start, end: region.end })
      })

      regionsPlugin.on('region-removed', () => {
        setActiveRegion(null)
      })

      if (spectrogramRef.current) {
        const spectrogramPlugin = Spectrogram.create({
          container: spectrogramRef.current,
          height: spectrogramHeight,
          labels: false,
        })
        ws.registerPlugin(spectrogramPlugin)
      } else {
        console.error('No spectrogram ref!')
      }
    })

    ws.on('play', () => {
      setIsPlaying(true)
    })
    ws.on('pause', () => {
      setIsPlaying(false)
    })
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()))
    ws.on('interaction', () => setCurrentTime(ws.getCurrentTime()))

    wavesurferRef.current = ws

    return () => {
      ws.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.object_url, waveformHeight, spectrogramHeight])

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const handleZoomIn = () => {
    const newZoom = zoom === 0 ? 100 : Math.min(zoom + 100, 10000)
    setZoom(newZoom)
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(newZoom)
    }
  }

  const handleZoomOut = () => {
    if (zoom === 0) return
    const newZoom = Math.max(zoom - 100, 0)
    setZoom(newZoom)
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(newZoom)
    }
  }

  const handleFit = () => {
    setZoom(0)
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(0)
    }
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseInt(e.target.value, 10)
    setZoom(newZoom)
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(newZoom)
    }
  }

  const handleRestart = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0)
      wavesurferRef.current.setTime(0)
      setCurrentTime(0)
    }
  }

  const handleSkipToEnd = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(1)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  const displayName = file.edited_name || file.name

  return (
    <div className="detail-view">
      <div className="detail-view-header">
        <div className="detail-view-title-section">
          <div className="detail-view-title">
            {displayName}
            {file.edited_name && '*'}
          </div>
          <div className="detail-view-metadata">
            <span>{formatDuration(file.duration)}</span>
            <span>{formatSampleRate(file.sample_rate)}</span>
            <span>{file.channels ? `${file.channels}ch` : '--'}</span>
          </div>
        </div>
        <IconButton name="Close" onClick={onClose} title="Close (Esc)" />
      </div>

      <div className="detail-view-controls">
        <IconButton name="Restart" onClick={handleRestart} title="Restart" />
        <IconButton
          name={isPlaying ? 'Pause' : 'Play'}
          onClick={handlePlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        />
        <IconButton
          name="Forward"
          onClick={handleSkipToEnd}
          title="Skip to End"
        />
        <div className="transport-time">
          {formatTime(currentTime || 0)} / {formatTime(file.duration || 0)}
        </div>

        <div className="toolbar-separator" />

        <IconButton
          name="Crop"
          disabled={!activeRegion}
          title="Crop (keep selection, remove rest)"
        />
        <IconButton
          name="ContentCut"
          disabled={!activeRegion}
          title="Trim (remove selection, keep rest)"
        />
        <IconButton
          name="ClearAll"
          disabled={!activeRegion}
          onClick={() => {
            if (regionsPluginRef.current) {
              regionsPluginRef.current.clearRegions()
            }
          }}
          title="Clear selection"
        />

        <div className="toolbar-separator" />

        <IconButton name="Tune" disabled title="Normalize" />
        <IconButton name="FadeIn" disabled title="Fade in" />
        <IconButton name="FadeOut" disabled title="Fade out" />

        <div className="zoom-controls">
          <div className="toolbar-separator" />
          <IconButton
            name="Fit"
            onClick={handleFit}
            disabled={zoom === 0}
            title="Fit to window"
          />
          <IconButton
            name="ZoomOut"
            onClick={handleZoomOut}
            disabled={zoom === 0}
            title="Zoom Out"
          />
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={zoom}
            onChange={handleZoomChange}
            className="zoom-range"
            title="Zoom level"
          />
          <IconButton
            name="ZoomIn"
            onClick={handleZoomIn}
            disabled={zoom >= 10000}
            title="Zoom In"
          />
        </div>
      </div>

      <div className="detail-view-content">
        <div className="detail-view-waveform" ref={waveformRef} />
        <div className="detail-view-spectrogram" ref={spectrogramRef} />
      </div>
    </div>
  )
}
