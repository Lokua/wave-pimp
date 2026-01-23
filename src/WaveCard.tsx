import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AudioFile, VisiblePeaks } from './types'
import { formatDuration, formatSize } from './util'
import WaveformCanvas from './WaveformCanvas'
import useAudioPlayback from './useAudioPlayback'
import { buildPeaksCache, getVisiblePeaksFromCache } from './waveformPeaks'

interface WaveCardProps extends React.HTMLAttributes<HTMLUListElement> {
  file: AudioFile
  audioContext: AudioContext
}

const MAX_CACHE_WIDTH = 7680

export default function WaveCard({
  file,
  audioContext,
  ...rest
}: WaveCardProps) {
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [samplesPerPixel, setSamplesPerPixel] = useState(1)
  const [visiblePeaks, setVisiblePeaks] = useState<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })

  const playback = useAudioPlayback({ audioContext, closeOnUnmount: false })
  const playbackRef = playback.playback
  const samplesPerPixelRef = useRef(samplesPerPixel)

  const nChannels = 1
  const sampleRate = file.audioBuffer.sampleRate
  const totalSamples = file.audioBuffer.getChannelData(0).length

  const peaksCache = useMemo(
    () => buildPeaksCache(file.audioBuffer, MAX_CACHE_WIDTH),
    [file],
  )

  useEffect(() => {
    playbackRef.current.setBuffer(file.audioBuffer)
  }, [file.audioBuffer, playbackRef])

  useEffect(() => {
    samplesPerPixelRef.current = samplesPerPixel
  }, [samplesPerPixel])

  useEffect(() => {
    if (canvasWidth <= 0) return
    let nextSamplesPerPixel = totalSamples / canvasWidth
    if (nextSamplesPerPixel < 1) nextSamplesPerPixel = 1
    const visibleSamples = canvasWidth * nextSamplesPerPixel
    const viewStartSample = 0
    const viewEndSample = viewStartSample + visibleSamples
    const peaks = getVisiblePeaksFromCache({
      peakCachePerChannel: peaksCache,
      nChannels,
      viewStartSample,
      viewEndSample,
      samplesPerPixel: nextSamplesPerPixel,
      canvasWidth,
    })
    setSamplesPerPixel(nextSamplesPerPixel)
    setVisiblePeaks(peaks)
  }, [canvasWidth, nChannels, peaksCache, totalSamples])

  const getCursorSample = () => playbackRef.current.getCurrentSample(sampleRate)

  const onClickCanvas = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const x = event.nativeEvent.offsetX
    const clickedSample = Math.floor(x * samplesPerPixelRef.current)
    const clickedTime = clickedSample / sampleRate
    playbackRef.current.seek(clickedTime)
  }

  const onClickPlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (playback.isPlaying) {
      playbackRef.current.stop()
    } else {
      playbackRef.current.play()
    }
  }

  return (
    <>
      <ul {...rest}>
        <li>name: {file.name}</li>
        <li>size: {formatSize(file.size)}</li>
        <li>type: {file.type.replace('audio/', '')}</li>
        <li>duration: {formatDuration(file.duration)}</li>
        <li>sampleRate: {file.sampleRate.toLocaleString()} kHz</li>
        <li>bitDepth: {file.bitDepth}</li>
        <li>channels: {file.channels}</li>
        <li>
          <button type="button" onClick={onClickPlay}>
            {playback.isPlaying ? 'Stop' : 'Play'}
          </button>
        </li>
      </ul>
      <WaveformCanvas
        nChannels={nChannels}
        visiblePeaks={visiblePeaks}
        viewStartSample={0}
        samplesPerPixel={samplesPerPixel}
        getCursorSample={getCursorSample}
        height={120}
        onResize={({ width }) => {
          setCanvasWidth(width)
        }}
        onClick={onClickCanvas}
      />
    </>
  )
}
