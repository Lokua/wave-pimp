import styled from '@emotion/styled'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AudioFile, SelectionRange, VisiblePeaks } from './types'
import WaveformCanvas from './WaveformCanvas'
import IconButton from './IconButton'
import useAudioPlayback from './useAudioPlayback'
import { buildPeaksCache, getVisiblePeaksFromCache } from './waveformPeaks'

const Controls = styled.div`
  padding: 0 32px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`

const CanvasContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px 32px;
  overflow: hidden;
`

const Divider = styled.span`
  width: 1px;
  background: var(--separator-color);
  margin: 0 8px;
`

const MAX_CACHE_WIDTH = 7680

type WaveEditorProps = {
  file: AudioFile
  audioContext: AudioContext
  onBack: () => void
  onUpdateFile: (next: AudioFile) => void
}

export default function WaveEditor({
  file,
  audioContext,
  onBack,
  onUpdateFile,
}: WaveEditorProps) {
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [viewStartSample, setViewStartSample] = useState(0)
  const [samplesPerPixel, setSamplesPerPixel] = useState(1)
  const [selection, setSelection] = useState<SelectionRange>({
    startSample: null,
    endSample: null,
  })
  const [visiblePeaks, setVisiblePeaks] = useState<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })
  const playback = useAudioPlayback({
    audioContext,
    closeOnUnmount: false,
  })
  const playbackRef = playback.playback

  const isSelectingRef = useRef(false)
  const autoScrollIntervalRef = useRef<number | null>(null)
  const lastMouseXRef = useRef(0)
  const justCompletedSelectionRef = useRef(false)
  const selectionRef = useRef<SelectionRange>(selection)
  const viewStartSampleRef = useRef(viewStartSample)
  const samplesPerPixelRef = useRef(samplesPerPixel)
  const canvasWidthRef = useRef(canvasWidth)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const audioBufferRef = useRef(file.audioBuffer)

  const nChannels = file.audioBuffer.numberOfChannels
  const sampleRate = file.audioBuffer.sampleRate
  const totalSamples = file.audioBuffer.getChannelData(0).length

  function buildCache() {
    return buildPeaksCache(file.audioBuffer, MAX_CACHE_WIDTH)
  }

  const peaksCache = useMemo(buildCache, [file.audioBuffer])

  useEffect(() => {
    playbackRef.current.setBuffer(file.audioBuffer)
    audioBufferRef.current = file.audioBuffer
    setZoomLevel(1)
    setViewStartSample(0)
    setSelection({ startSample: null, endSample: null })
  }, [file.audioBuffer, playbackRef])

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    viewStartSampleRef.current = viewStartSample
  }, [viewStartSample])

  useEffect(() => {
    samplesPerPixelRef.current = samplesPerPixel
  }, [samplesPerPixel])

  useEffect(() => {
    canvasWidthRef.current = canvasWidth
  }, [canvasWidth])

  useEffect(() => {
    if (canvasWidth <= 0) return
    let nextSamplesPerPixel = totalSamples / (canvasWidth * zoomLevel)
    if (nextSamplesPerPixel < 1) nextSamplesPerPixel = 1

    const visibleSamples = canvasWidth * nextSamplesPerPixel
    const maxStart = Math.max(0, totalSamples - visibleSamples)
    const clampedViewStart = Math.max(0, Math.min(viewStartSample, maxStart))
    if (clampedViewStart !== viewStartSample) {
      setViewStartSample(clampedViewStart)
      return
    }

    const viewEndSample = clampedViewStart + visibleSamples
    const peaks = getVisiblePeaksFromCache({
      peakCachePerChannel: peaksCache,
      nChannels,
      viewStartSample: clampedViewStart,
      viewEndSample,
      samplesPerPixel: nextSamplesPerPixel,
      canvasWidth,
    })

    setSamplesPerPixel(nextSamplesPerPixel)
    setVisiblePeaks(peaks)
  }, [
    canvasWidth,
    nChannels,
    peaksCache,
    totalSamples,
    viewStartSample,
    zoomLevel,
  ])

  function getCursorSample() {
    if (!audioBufferRef.current) return null
    return playbackRef.current.getCurrentSample(sampleRate)
  }

  function onClickBack() {
    onBack()
  }

  function onClickPlay() {
    if (!audioBufferRef.current) return

    if (playback.isPlaying) {
      playbackRef.current.stop()
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        const start = Math.min(startSample, endSample)
        playbackRef.current.play({ fromSeconds: start / sampleRate })
      } else {
        playbackRef.current.play({ fromSeconds: 0 })
      }
      return
    }

    playbackRef.current.play()
  }

  function onClickStop() {
    if (!audioBufferRef.current) return
    if (playback.isPlaying) {
      playbackRef.current.pause()
    } else {
      playbackRef.current.stop()
    }
  }

  function onClickCanvas(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!audioBufferRef.current || event.shiftKey) return
    if (justCompletedSelectionRef.current) {
      justCompletedSelectionRef.current = false
      return
    }

    const x = event.nativeEvent.offsetX
    const clickedSample = Math.floor(
      viewStartSample + x * samplesPerPixelRef.current,
    )
    const clickedTime = clickedSample / sampleRate
    playbackRef.current.seek(clickedTime)
  }

  function onMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!audioBufferRef.current) return

    const clickedSample = Math.floor(
      viewStartSampleRef.current +
        event.nativeEvent.offsetX * samplesPerPixelRef.current,
    )

    if (event.shiftKey && selectionRef.current.startSample != null) {
      const { startSample, endSample } = selectionRef.current
      const distToStart = Math.abs(clickedSample - (startSample ?? 0))
      const distToEnd = Math.abs(clickedSample - (endSample ?? 0))

      if (distToStart < distToEnd) {
        setSelection({ startSample: clickedSample, endSample })
      } else {
        setSelection({ startSample, endSample: clickedSample })
      }
      return
    }

    setSelection({ startSample: clickedSample, endSample: clickedSample })
    isSelectingRef.current = true
    canvasRectRef.current = event.currentTarget.getBoundingClientRect()
    document.addEventListener('mousemove', onDocumentMouseMove)
    document.addEventListener('mouseup', onDocumentMouseUp)
  }

  function onMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!isSelectingRef.current) return
    lastMouseXRef.current = event.nativeEvent.offsetX
    updateSelectionAndScroll()
  }

  function onMouseUp() {
    if (!isSelectingRef.current) return
    isSelectingRef.current = false

    if (autoScrollIntervalRef.current) {
      window.clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }

    const { startSample, endSample } = selectionRef.current
    if (startSample != null && endSample != null) {
      if (startSample > endSample) {
        setSelection({ startSample: endSample, endSample: startSample })
      } else if (startSample === endSample) {
        setSelection({ startSample: null, endSample: null })
      } else {
        playbackRef.current.seek(startSample / sampleRate)
        justCompletedSelectionRef.current = true
      }
    }
  }

  function onDocumentMouseMove(event: MouseEvent) {
    if (!isSelectingRef.current) return
    const rect = canvasRectRef.current
    if (!rect) return
    lastMouseXRef.current = event.clientX - rect.left
    updateSelectionAndScroll()
  }

  function onDocumentMouseUp() {
    document.removeEventListener('mousemove', onDocumentMouseMove)
    document.removeEventListener('mouseup', onDocumentMouseUp)
    onMouseUp()
  }

  function updateSelectionAndScroll() {
    if (!isSelectingRef.current || !audioBufferRef.current) return

    const width = canvasWidthRef.current
    const samplesPerPixelValue = samplesPerPixelRef.current
    const total = audioBufferRef.current.getChannelData(0).length
    const visibleSamples = width * samplesPerPixelValue
    const maxStart = Math.max(0, total - visibleSamples)

    const clampedMouseX = Math.max(0, Math.min(lastMouseXRef.current, width))
    const selectionEndSample = Math.floor(
      viewStartSampleRef.current + clampedMouseX * samplesPerPixelValue,
    )

    setSelection({
      startSample: selectionRef.current.startSample,
      endSample: selectionEndSample,
    })

    const scrollMargin = 50
    const shouldScrollLeft =
      lastMouseXRef.current <= scrollMargin && viewStartSampleRef.current > 0
    const shouldScrollRight =
      lastMouseXRef.current >= width - scrollMargin &&
      viewStartSampleRef.current < maxStart

    if (
      (shouldScrollLeft || shouldScrollRight) &&
      !autoScrollIntervalRef.current
    ) {
      autoScrollIntervalRef.current = window.setInterval(() => {
        if (!isSelectingRef.current) {
          if (autoScrollIntervalRef.current) {
            window.clearInterval(autoScrollIntervalRef.current)
            autoScrollIntervalRef.current = null
          }
          return
        }

        const currentSamplesPerPixel = samplesPerPixelRef.current
        const scrollSpeed = currentSamplesPerPixel * 10
        const width = canvasWidthRef.current
        const total = audioBufferRef.current?.getChannelData(0).length ?? 0
        const visibleSamples = width * currentSamplesPerPixel
        const maxStart = Math.max(0, total - visibleSamples)

        const shouldScrollLeft =
          lastMouseXRef.current <= scrollMargin &&
          viewStartSampleRef.current > 0
        const shouldScrollRight =
          lastMouseXRef.current >= width - scrollMargin &&
          viewStartSampleRef.current < maxStart

        if (!shouldScrollLeft && !shouldScrollRight) {
          if (autoScrollIntervalRef.current) {
            window.clearInterval(autoScrollIntervalRef.current)
            autoScrollIntervalRef.current = null
          }
          return
        }

        if (shouldScrollLeft) {
          setViewStartSample((prev) => Math.max(0, prev - scrollSpeed))
        } else if (shouldScrollRight) {
          setViewStartSample((prev) => Math.min(maxStart, prev + scrollSpeed))
        }

        const clampedMouseX = Math.max(
          0,
          Math.min(lastMouseXRef.current, width),
        )
        setSelection({
          startSample: selectionRef.current.startSample,
          endSample: Math.floor(
            viewStartSampleRef.current + clampedMouseX * currentSamplesPerPixel,
          ),
        })
      }, 16)
    }
  }

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (!audioBufferRef.current) return
    event.preventDefault()
    const delta =
      event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0
    if (delta === 0) return
    const panAmount = delta * samplesPerPixelRef.current * 5
    setViewStartSample((prev) => prev + panAmount)
  }

  function onClickZoomIn() {
    if (!audioBufferRef.current || canvasWidth <= 0) return
    const playheadSample = playbackRef.current.getCurrentSample(sampleRate)
    const cursorScreenX =
      (playheadSample - viewStartSampleRef.current) / samplesPerPixelRef.current

    let nextZoom = zoomLevel * 1.5
    let newSamplesPerPixel = totalSamples / (canvasWidth * nextZoom)
    if (newSamplesPerPixel < 1) {
      newSamplesPerPixel = 1
      nextZoom = totalSamples / (canvasWidth * 1)
    }

    const nextViewStart = playheadSample - cursorScreenX * newSamplesPerPixel
    setZoomLevel(nextZoom)
    setViewStartSample(nextViewStart)
  }

  function onClickZoomOut() {
    if (!audioBufferRef.current || canvasWidth <= 0) return
    const playheadSample = playbackRef.current.getCurrentSample(sampleRate)
    const cursorScreenX =
      (playheadSample - viewStartSampleRef.current) / samplesPerPixelRef.current

    let nextZoom = Math.max(1, zoomLevel / 1.5)
    let newSamplesPerPixel = totalSamples / (canvasWidth * nextZoom)
    if (newSamplesPerPixel < 1) {
      newSamplesPerPixel = 1
      nextZoom = totalSamples / (canvasWidth * 1)
    }

    const nextViewStart = playheadSample - cursorScreenX * newSamplesPerPixel
    setZoomLevel(nextZoom)
    setViewStartSample(nextViewStart)
  }

  function onClickZoomFit() {
    if (!audioBufferRef.current) return
    setZoomLevel(1)
    setViewStartSample(0)
  }

  function performAudioEdit(
    editFn: () => AudioBuffer | null,
    preserveSelection: boolean,
  ) {
    if (!audioBufferRef.current) return
    if (playback.isPlaying) {
      playbackRef.current.stop()
    }

    const result = editFn()
    if (result instanceof AudioBuffer) {
      const nextFile = {
        ...file,
        audioBuffer: result,
        duration: result.duration,
      }
      onUpdateFile(nextFile)
      setSelection({ startSample: null, endSample: null })
      setViewStartSample(0)
      setZoomLevel(1)
      return
    }

    onUpdateFile({
      ...file,
      audioBuffer: audioBufferRef.current,
      duration: audioBufferRef.current.duration,
    })
    if (!preserveSelection) {
      setSelection({ startSample: null, endSample: null })
      setViewStartSample(0)
      setZoomLevel(1)
    }
  }

  function onClickCrop() {
    performAudioEdit(() => {
      const { startSample, endSample } = selectionRef.current
      if (startSample == null || endSample == null) {
        alert('Please make a selection first')
        return null
      }

      const start = Math.min(startSample, endSample)
      const end = Math.max(startSample, endSample)
      const croppedLength = end - start

      const croppedBuffer = audioContext.createBuffer(
        nChannels,
        croppedLength,
        sampleRate,
      )

      for (let ch = 0; ch < nChannels; ch++) {
        const originalData = audioBufferRef.current.getChannelData(ch)
        const croppedData = croppedBuffer.getChannelData(ch)
        for (let i = 0; i < croppedLength; i++) {
          croppedData[i] = originalData[start + i]
        }
      }

      return croppedBuffer
    }, false)
  }

  function onClickTrim() {
    performAudioEdit(() => {
      const { startSample, endSample } = selectionRef.current
      if (startSample == null || endSample == null) {
        alert('Please make a selection first')
        return null
      }

      const start = Math.min(startSample, endSample)
      const end = Math.max(startSample, endSample)
      const originalLength = audioBufferRef.current.getChannelData(0).length
      const trimmedLength = originalLength - (end - start)

      const trimmedBuffer = audioContext.createBuffer(
        nChannels,
        trimmedLength,
        sampleRate,
      )

      for (let ch = 0; ch < nChannels; ch++) {
        const originalData = audioBufferRef.current.getChannelData(ch)
        const trimmedData = trimmedBuffer.getChannelData(ch)

        for (let i = 0; i < start; i++) {
          trimmedData[i] = originalData[i]
        }

        for (let i = end; i < originalLength; i++) {
          trimmedData[i - (end - start)] = originalData[i]
        }
      }

      return trimmedBuffer
    }, false)
  }

  function onClickFadeIn() {
    performAudioEdit(() => {
      const totalLength = audioBufferRef.current.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBufferRef.current.getChannelData(ch)
        for (let i = 0; i < fadeLength; i++) {
          const gain = i / fadeLength
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function onClickFadeOut() {
    performAudioEdit(() => {
      const totalLength = audioBufferRef.current.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBufferRef.current.getChannelData(ch)
        for (let i = 0; i < fadeLength; i++) {
          const gain = 1 - i / fadeLength
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function onClickNormalize() {
    performAudioEdit(() => {
      const totalLength = audioBufferRef.current.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const selectionLength = end - start
      const target = 0.999
      let max = 0

      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBufferRef.current.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          const sample = channelData[start + i]
          if (Math.abs(sample) > max) {
            max = Math.abs(sample)
          }
        }
      }

      const gain = max === 0 ? 1 : target / max
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBufferRef.current.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function onClickSelectToStart() {
    if (!audioBufferRef.current) return
    const cursorSample = playbackRef.current.getCurrentSample(sampleRate)
    setSelection({ startSample: 0, endSample: cursorSample })
    playbackRef.current.seek(0)
  }

  function onClickSelectToEnd() {
    if (!audioBufferRef.current) return
    const cursorSample = playbackRef.current.getCurrentSample(sampleRate)
    setSelection({ startSample: cursorSample, endSample: totalSamples })
    playbackRef.current.seek(cursorSample / sampleRate)
  }

  function onResizeCanvas(size: { width: number }) {
    setCanvasWidth(size.width)
  }

  return (
    <>
      <Controls>
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
        <Divider />
        <IconButton
          type="button"
          name="ZoomIn"
          aria-label="Zoom in"
          onClick={onClickZoomIn}
        />
        <IconButton
          type="button"
          name="ZoomOut"
          aria-label="Zoom out"
          onClick={onClickZoomOut}
        />
        <IconButton
          type="button"
          name="ZoomFit"
          aria-label="Zoom to fit"
          onClick={onClickZoomFit}
        />
        <Divider />
        <IconButton
          type="button"
          name="SelectFromStart"
          aria-label="Select From Start"
          onClick={onClickSelectToStart}
        />
        <IconButton
          type="button"
          name="SelectToEnd"
          aria-label="Select To End"
          onClick={onClickSelectToEnd}
        />
        <Divider />
        <IconButton
          type="button"
          name="Crop"
          aria-label="Crop"
          onClick={onClickCrop}
        />
        <IconButton
          type="button"
          name="Trim"
          aria-label="Trim"
          onClick={onClickTrim}
        />
        <IconButton
          type="button"
          name="FadeIn"
          aria-label="Fade in"
          onClick={onClickFadeIn}
        />
        <IconButton
          type="button"
          name="FadeOut"
          aria-label="Fade out"
          onClick={onClickFadeOut}
        />
        <IconButton
          type="button"
          name="Normalize"
          aria-label="Normalize"
          onClick={onClickNormalize}
        />
        <IconButton
          type="button"
          name="Back"
          aria-label="Back"
          onClick={onClickBack}
          style={{ marginLeft: 'auto' }}
        />
      </Controls>
      <CanvasContainer>
        <WaveformCanvas
          nChannels={nChannels}
          visiblePeaks={visiblePeaks}
          viewStartSample={viewStartSample}
          samplesPerPixel={samplesPerPixel}
          selection={selection}
          getCursorSample={getCursorSample}
          onResize={onResizeCanvas}
          onClick={onClickCanvas}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        />
      </CanvasContainer>
    </>
  )
}
