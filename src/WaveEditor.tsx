import styled from '@emotion/styled'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AudioFile, SelectionRange, Settings, VisiblePeaks } from './types'
import WaveformCanvas from './WaveformCanvas'
import IconButton from './IconButton'
import useAudioPlayback from './useAudioPlayback'
import { buildPeaksCache, getVisiblePeaksFromCache } from './waveformPeaks'
import { encodeWavForSettings } from './wavExport'
import Toast from './Toast'
import useToast from './useToast'

const Controls = styled.div`
  padding: 0 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`

const CanvasContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px 8px 12px;
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
  settings: Settings
  audioContext: AudioContext
  onBack: () => void
  onUpdateFile: (next: AudioFile) => void
}

export default function WaveEditor({
  file,
  settings,
  audioContext,
  onBack,
  onUpdateFile,
}: WaveEditorProps) {
  const [canvasRevision, setCanvasRevision] = useState(0)
  const { message: toastMessage, showToast } = useToast()
  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer: file.audioBuffer,
  })

  const isSelectingRef = useRef(false)
  const autoScrollIntervalRef = useRef<number | null>(null)
  const lastMouseXRef = useRef(0)
  const justCompletedSelectionRef = useRef(false)
  const canvasWidthRef = useRef(0)
  const zoomLevelRef = useRef(1)
  const viewStartSampleRef = useRef(0)
  const samplesPerPixelRef = useRef(1)
  const selectionRef = useRef<SelectionRange>({
    startSample: null,
    endSample: null,
  })
  const preserveSelectionOnNextBufferRef = useRef(false)
  const visiblePeaksRef = useRef<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })
  const canvasRectRef = useRef<DOMRect | null>(null)
  const audioBuffer = file.audioBuffer

  const nChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const totalSamples = audioBuffer.getChannelData(0).length

  const peaksCache = useMemo(
    () => buildPeaksCache(audioBuffer, MAX_CACHE_WIDTH),
    [audioBuffer],
  )

  function recalculateVisiblePeaks() {
    const canvasWidth = canvasWidthRef.current
    const zoomLevel = zoomLevelRef.current
    const viewStartSample = viewStartSampleRef.current

    if (canvasWidth <= 0) return

    let nextSamplesPerPixel = totalSamples / (canvasWidth * zoomLevel)
    if (nextSamplesPerPixel < 1) nextSamplesPerPixel = 1

    const visibleSamples = canvasWidth * nextSamplesPerPixel
    const maxStart = Math.max(0, totalSamples - visibleSamples)
    const clampedViewStart = Math.max(0, Math.min(viewStartSample, maxStart))

    if (clampedViewStart !== viewStartSample) {
      viewStartSampleRef.current = clampedViewStart
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

    samplesPerPixelRef.current = nextSamplesPerPixel
    visiblePeaksRef.current = peaks
    setCanvasRevision((r) => r + 1)
  }

  useEffect(() => {
    if (canvasRevision === 0) {
      recalculateVisiblePeaks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRevision])

  useEffect(() => {
    const preserveSelection = preserveSelectionOnNextBufferRef.current
    preserveSelectionOnNextBufferRef.current = false
    playbackRef.current.stop()
    playbackRef.current.setBuffer(audioBuffer)
    if (!preserveSelection) {
      zoomLevelRef.current = 1
      viewStartSampleRef.current = 0
      selectionRef.current = { startSample: null, endSample: null }
    }
    recalculateVisiblePeaks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      onBack()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onBack])

  function updateSelection(next: SelectionRange) {
    selectionRef.current = next
    setCanvasRevision((r) => r + 1)
  }

  function getCursorSample() {
    return playbackRef.current.getCurrentSample(sampleRate)
  }

  function ensureWavExtension(name: string) {
    return name.toLowerCase().endsWith('.wav') ? name : `${name}.wav`
  }

  function getFileNameFromPath(filePath: string) {
    return filePath.split(/[\\/]/).pop() ?? filePath
  }

  async function saveWav({
    forceDialog,
    toastLabel,
  }: {
    forceDialog: boolean
    toastLabel: string
  }) {
    const bytes = await encodeWavForSettings(audioBuffer, settings)
    const fallbackName = ensureWavExtension(file.name)
    const defaultPath = file.filePath ?? fallbackName

    const result = (await window.electron.invoke('save-wav', {
      bytes,
      path: forceDialog ? undefined : file.filePath,
      defaultPath,
    })) as { canceled?: boolean; path?: string }

    if (!result || result.canceled || !result.path) return

    if (result.path !== file.filePath) {
      const nextName = getFileNameFromPath(result.path)
      onUpdateFile({
        ...file,
        filePath: result.path,
        name: nextName,
      })
    }

    showToast(toastLabel)
  }

  function onClickPlay() {
    if (playbackState.isPlaying) {
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
    if (playbackState.isPlaying) {
      playbackRef.current.pause()
    } else {
      playbackRef.current.stop()
    }
  }

  function onClickCanvas(event: React.MouseEvent<HTMLCanvasElement>) {
    if (event.shiftKey) return
    if (justCompletedSelectionRef.current) {
      justCompletedSelectionRef.current = false
      return
    }

    const x = event.nativeEvent.offsetX
    const clickedSample = Math.floor(
      viewStartSampleRef.current + x * samplesPerPixelRef.current,
    )
    const clickedTime = clickedSample / sampleRate
    playbackRef.current.seek(clickedTime)
  }

  function onMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    const clickedSample = Math.floor(
      viewStartSampleRef.current +
        event.nativeEvent.offsetX * samplesPerPixelRef.current,
    )

    if (event.shiftKey && selectionRef.current.startSample != null) {
      const { startSample, endSample } = selectionRef.current
      const distToStart = Math.abs(clickedSample - (startSample ?? 0))
      const distToEnd = Math.abs(clickedSample - (endSample ?? 0))

      if (distToStart < distToEnd) {
        updateSelection({ startSample: clickedSample, endSample })
      } else {
        updateSelection({ startSample, endSample: clickedSample })
      }
      return
    }

    updateSelection({ startSample: clickedSample, endSample: clickedSample })
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
        updateSelection({ startSample: endSample, endSample: startSample })
      } else if (startSample === endSample) {
        updateSelection({ startSample: null, endSample: null })
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
    if (!isSelectingRef.current) return

    const width = canvasWidthRef.current
    const samplesPerPixelValue = samplesPerPixelRef.current
    const total = audioBuffer.getChannelData(0).length
    const visibleSamples = width * samplesPerPixelValue
    const maxStart = Math.max(0, total - visibleSamples)

    const clampedMouseX = Math.max(0, Math.min(lastMouseXRef.current, width))
    const selectionEndSample = Math.floor(
      viewStartSampleRef.current + clampedMouseX * samplesPerPixelValue,
    )

    updateSelection({
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
        const total = audioBuffer.getChannelData(0).length
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
          viewStartSampleRef.current = Math.max(
            0,
            viewStartSampleRef.current - scrollSpeed,
          )
        } else if (shouldScrollRight) {
          viewStartSampleRef.current = Math.min(
            maxStart,
            viewStartSampleRef.current + scrollSpeed,
          )
        }

        recalculateVisiblePeaks()

        const clampedMouseX = Math.max(
          0,
          Math.min(lastMouseXRef.current, width),
        )
        updateSelection({
          startSample: selectionRef.current.startSample,
          endSample: Math.floor(
            viewStartSampleRef.current + clampedMouseX * currentSamplesPerPixel,
          ),
        })
      }, 16)
    }
  }

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0
    if (delta === 0) return

    const width = canvasWidthRef.current
    const samplesPerPixelValue = samplesPerPixelRef.current
    const visibleSamples = width * samplesPerPixelValue
    const maxStart = Math.max(0, totalSamples - visibleSamples)
    const panAmount = delta * samplesPerPixelValue * 5
    const next = Math.max(
      0,
      Math.min(viewStartSampleRef.current + panAmount, maxStart),
    )
    if (next === viewStartSampleRef.current) return
    event.preventDefault()
    viewStartSampleRef.current = next
    recalculateVisiblePeaks()
  }

  function onClickZoomIn() {
    if (canvasWidthRef.current <= 0) return
    const playheadSample = playbackRef.current.getCurrentSample(sampleRate)
    const cursorScreenX =
      (playheadSample - viewStartSampleRef.current) / samplesPerPixelRef.current

    let nextZoom = zoomLevelRef.current * 1.5
    let newSamplesPerPixel = totalSamples / (canvasWidthRef.current * nextZoom)
    if (newSamplesPerPixel < 1) {
      newSamplesPerPixel = 1
      nextZoom = totalSamples / (canvasWidthRef.current * 1)
    }

    const nextViewStart = playheadSample - cursorScreenX * newSamplesPerPixel
    zoomLevelRef.current = nextZoom
    viewStartSampleRef.current = nextViewStart
    recalculateVisiblePeaks()
  }

  function onClickZoomOut() {
    if (canvasWidthRef.current <= 0) return
    const playheadSample = playbackRef.current.getCurrentSample(sampleRate)
    const cursorScreenX =
      (playheadSample - viewStartSampleRef.current) / samplesPerPixelRef.current

    let nextZoom = Math.max(1, zoomLevelRef.current / 1.5)
    let newSamplesPerPixel = totalSamples / (canvasWidthRef.current * nextZoom)
    if (newSamplesPerPixel < 1) {
      newSamplesPerPixel = 1
      nextZoom = totalSamples / (canvasWidthRef.current * 1)
    }

    const nextViewStart = playheadSample - cursorScreenX * newSamplesPerPixel
    zoomLevelRef.current = nextZoom
    viewStartSampleRef.current = nextViewStart
    recalculateVisiblePeaks()
  }

  function onClickZoomFit() {
    zoomLevelRef.current = 1
    viewStartSampleRef.current = 0
    recalculateVisiblePeaks()
  }

  function performAudioEdit(
    editFn: () => AudioBuffer | null,
    preserveSelection: boolean,
  ) {
    if (playbackState.isPlaying) {
      playbackRef.current.stop()
    }

    const result = editFn()
    if (result instanceof AudioBuffer) {
      const nextFile = {
        ...file,
        audioBuffer: result,
        duration: result.duration,
      }
      playbackRef.current.setBuffer(result)
      onUpdateFile(nextFile)
      updateSelection({ startSample: null, endSample: null })
      viewStartSampleRef.current = 0
      zoomLevelRef.current = 1
      recalculateVisiblePeaks()
      return
    }

    preserveSelectionOnNextBufferRef.current = preserveSelection
    const sourceBuffer = audioBuffer
    const nextBuffer = audioContext.createBuffer(
      sourceBuffer.numberOfChannels,
      sourceBuffer.length,
      sourceBuffer.sampleRate,
    )
    for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
      nextBuffer.copyToChannel(sourceBuffer.getChannelData(ch), ch)
    }
    playbackRef.current.setBuffer(nextBuffer)
    onUpdateFile({
      ...file,
      audioBuffer: nextBuffer,
      duration: nextBuffer.duration,
    })
    if (!preserveSelection) {
      updateSelection({ startSample: null, endSample: null })
      viewStartSampleRef.current = 0
      zoomLevelRef.current = 1
      recalculateVisiblePeaks()
    } else {
      setCanvasRevision((r) => r + 1)
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
        const originalData = audioBuffer.getChannelData(ch)
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
      const originalLength = audioBuffer.getChannelData(0).length
      const trimmedLength = originalLength - (end - start)

      const trimmedBuffer = audioContext.createBuffer(
        nChannels,
        trimmedLength,
        sampleRate,
      )

      for (let ch = 0; ch < nChannels; ch++) {
        const originalData = audioBuffer.getChannelData(ch)
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
      const totalLength = audioBuffer.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
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
      const totalLength = audioBuffer.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
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
      const totalLength = audioBuffer.getChannelData(0).length
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
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          const sample = channelData[start + i]
          if (Math.abs(sample) > max) {
            max = Math.abs(sample)
          }
        }
      }

      const gain = max === 0 ? 1 : target / max
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function onClickSelectToStart() {
    const cursorSample = playbackRef.current.getCurrentSample(sampleRate)
    updateSelection({ startSample: 0, endSample: cursorSample })
    playbackRef.current.seek(0)
  }

  function onClickSelectToEnd() {
    const cursorSample = playbackRef.current.getCurrentSample(sampleRate)
    updateSelection({ startSample: cursorSample, endSample: totalSamples })
    playbackRef.current.seek(cursorSample / sampleRate)
  }

  function onClickSave() {
    const forceDialog = !file.filePath
    void saveWav({
      forceDialog,
      toastLabel: 'Saved',
    })
  }

  function onClickSaveAs() {
    void saveWav({
      forceDialog: true,
      toastLabel: 'Saved As',
    })
  }

  function onResizeCanvas(size: { width: number }) {
    canvasWidthRef.current = size.width
    recalculateVisiblePeaks()
  }

  return (
    <>
      <Controls>
        <IconButton
          type="button"
          name="Play"
          aria-label="Play"
          title="Play"
          onClick={onClickPlay}
        />
        <IconButton
          type="button"
          name={playbackState.isPlaying ? 'Pause' : 'Stop'}
          aria-label={playbackState.isPlaying ? 'Pause' : 'Stop'}
          title={playbackState.isPlaying ? 'Pause' : 'Stop'}
          onClick={onClickStop}
        />
        <Divider />
        <IconButton
          type="button"
          name="ZoomIn"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={onClickZoomIn}
        />
        <IconButton
          type="button"
          name="ZoomOut"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={onClickZoomOut}
        />
        <IconButton
          type="button"
          name="ZoomFit"
          aria-label="Zoom to fit"
          title="Zoom to fit"
          onClick={onClickZoomFit}
        />
        <Divider />
        <IconButton
          type="button"
          name="SelectFromStart"
          aria-label="Select From Start"
          title="Select from start"
          onClick={onClickSelectToStart}
        />
        <IconButton
          type="button"
          name="SelectToEnd"
          aria-label="Select To End"
          title="Select to end"
          onClick={onClickSelectToEnd}
        />
        <Divider />
        <IconButton
          type="button"
          name="Crop"
          aria-label="Crop"
          title="Crop"
          onClick={onClickCrop}
        />
        <IconButton
          type="button"
          name="Trim"
          aria-label="Trim"
          title="Trim"
          onClick={onClickTrim}
        />
        <IconButton
          type="button"
          name="FadeIn"
          aria-label="Fade in"
          title="Fade in"
          onClick={onClickFadeIn}
        />
        <IconButton
          type="button"
          name="FadeOut"
          aria-label="Fade out"
          title="Fade out"
          onClick={onClickFadeOut}
        />
        <IconButton
          type="button"
          name="Normalize"
          aria-label="Normalize"
          title="Normalize"
          onClick={onClickNormalize}
        />
        <Divider />
        <IconButton
          type="button"
          name="Save"
          aria-label="Save"
          title="Save"
          onClick={onClickSave}
        />
        <IconButton
          type="button"
          name="SaveAs"
          aria-label="Save As"
          title="Save As"
          onClick={onClickSaveAs}
        />
        <IconButton
          type="button"
          name="Back"
          aria-label="Back"
          title="Back to list (Esc)"
          onClick={onBack}
          style={{ marginLeft: 'auto' }}
        />
      </Controls>
      <CanvasContainer>
        <WaveformCanvas
          nChannels={nChannels}
          visiblePeaks={visiblePeaksRef.current}
          viewStartSample={viewStartSampleRef.current}
          samplesPerPixel={samplesPerPixelRef.current}
          selection={selectionRef.current}
          canvasRevision={canvasRevision}
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
      <Toast message={toastMessage} />
    </>
  )
}
