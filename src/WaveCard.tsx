import { useEffect, useMemo, useRef, useState } from 'react'
import styled from '@emotion/styled'

import type { AudioFile, VisiblePeaks } from './types'
import { formatDuration, formatSize } from './util'
import WaveformCanvas from './WaveformCanvas'
import useAudioPlayback from './useAudioPlayback'
import { buildPeaksCache, getVisiblePeaksFromCache } from './waveformPeaks'
import IconButton from './IconButton'

const Card = styled.article`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
  padding: 16px;
  gap: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-controls);
`

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`

const Actions = styled.div`
  display: flex;
  /* margin-left: auto; */
  gap: 8px;
`

const MetaGrid = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
`

const MetaItem = styled.div`
  display: grid;
  gap: 2px;
`

const MetaLabel = styled.dt`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
`

const MetaValue = styled.dd`
  margin: 0;
  font-size: 12px;
`

type WaveCardProps = {
  file: AudioFile
  audioContext: AudioContext
  onEdit: (file: AudioFile) => void
}

const MAX_CACHE_WIDTH = 7680

export default function WaveCard({
  file,
  audioContext,
  onEdit,
}: WaveCardProps) {
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [samplesPerPixel, setSamplesPerPixel] = useState(1)
  const [visiblePeaks, setVisiblePeaks] = useState<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })

  const playback = useAudioPlayback({
    audioContext,
    closeOnUnmount: false,
  })
  const playbackRef = playback.playback
  const samplesPerPixelRef = useRef(samplesPerPixel)

  const nChannels = 1
  const sampleRate = file.audioBuffer.sampleRate
  const totalSamples = file.audioBuffer.getChannelData(0).length

  function buildCache() {
    return buildPeaksCache(file.audioBuffer, MAX_CACHE_WIDTH)
  }

  const peaksCache = useMemo(buildCache, [file])

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

  function getCursorSample() {
    return playbackRef.current.getCurrentSample(sampleRate)
  }

  function onClickCanvas(event: React.MouseEvent<HTMLCanvasElement>) {
    const x = event.nativeEvent.offsetX
    const clickedSample = Math.floor(x * samplesPerPixelRef.current)
    const clickedTime = clickedSample / sampleRate
    playbackRef.current.seek(clickedTime)
  }

  function onClickPlay() {
    if (playback.isPlaying) {
      playbackRef.current.stop()
      playbackRef.current.play({ fromSeconds: 0 })
      return
    }

    playbackRef.current.play()
  }

  function onClickStop() {
    if (playback.isPlaying) {
      playbackRef.current.pause()
    } else {
      playbackRef.current.stop()
    }
  }

  function onClickEdit() {
    onEdit(file)
  }

  function onResizeCanvas(size: { width: number }) {
    setCanvasWidth(size.width)
  }

  return (
    <Card>
      <Title>{file.name}</Title>
      <Actions>
        <IconButton
          type="button"
          name="Play"
          aria-label="Play"
          onClick={onClickPlay}
        />
        <IconButton
          type="button"
          name={playback.isPlaying ? 'Pause' : 'Stop'}
          aria-label={playback.isPlaying ? 'Pause' : 'Stop'}
          onClick={onClickStop}
        />
        <IconButton
          type="button"
          name="Edit"
          aria-label="Edit"
          onClick={onClickEdit}
          style={{ marginLeft: 'auto' }}
        />
      </Actions>
      <WaveformCanvas
        nChannels={nChannels}
        visiblePeaks={visiblePeaks}
        viewStartSample={0}
        samplesPerPixel={samplesPerPixel}
        getCursorSample={getCursorSample}
        height={120}
        onResize={onResizeCanvas}
        onClick={onClickCanvas}
      />
      <MetaGrid>
        <MetaItem>
          <MetaLabel>Duration</MetaLabel>
          <MetaValue>{formatDuration(file.duration)}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Size</MetaLabel>
          <MetaValue>{formatSize(file.size)}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Sample Rate</MetaLabel>
          <MetaValue>{file.sampleRate.toLocaleString()} kHz</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Bit Depth</MetaLabel>
          <MetaValue>{file.bitDepth}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Channels</MetaLabel>
          <MetaValue>{file.channels}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Type</MetaLabel>
          <MetaValue>{file.type.replace('audio/', '')}</MetaValue>
        </MetaItem>
      </MetaGrid>
    </Card>
  )
}
