import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { VisiblePeaks } from '../types'
import { buildPeaksCache, getVisiblePeaksFromCache } from './peaks'

type UseViewportArgs = {
  audioBuffer: AudioBuffer
  maxCacheWidth: number
  getCursorSample: () => number | null
}

export default function useViewport({
  audioBuffer,
  maxCacheWidth,
  getCursorSample,
}: UseViewportArgs) {
  const [canvasRevision, setCanvasRevision] = useState(0)
  const canvasWidthRef = useRef(0)
  const zoomLevelRef = useRef(1)
  const viewStartSampleRef = useRef(0)
  const samplesPerPixelRef = useRef(1)
  const visiblePeaksRef = useRef<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })

  const nChannels = audioBuffer.numberOfChannels
  const totalSamples = audioBuffer.getChannelData(0).length

  const peaksCache = useMemo(
    () => buildPeaksCache(audioBuffer, maxCacheWidth),
    [audioBuffer, maxCacheWidth],
  )

  const bumpCanvasRevision = useCallback(() => {
    setCanvasRevision((r) => r + 1)
  }, [])

  const recalculateVisiblePeaks = useCallback(() => {
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
    bumpCanvasRevision()
  }, [bumpCanvasRevision, nChannels, peaksCache, totalSamples])

  useEffect(() => {
    if (canvasRevision === 0) {
      recalculateVisiblePeaks()
    }
  }, [canvasRevision, recalculateVisiblePeaks])

  const onResize = useCallback(
    (size: { width: number }) => {
      canvasWidthRef.current = size.width
      recalculateVisiblePeaks()
    },
    [recalculateVisiblePeaks],
  )

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
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
    viewStartSampleRef.current = next
    recalculateVisiblePeaks()
  }

  const onZoomIn = useCallback(() => {
    if (canvasWidthRef.current <= 0) return
    const playheadSample = getCursorSample() ?? 0
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
  }, [getCursorSample, recalculateVisiblePeaks, totalSamples])

  const onZoomOut = useCallback(() => {
    if (canvasWidthRef.current <= 0) return
    const playheadSample = getCursorSample() ?? 0
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
  }, [getCursorSample, recalculateVisiblePeaks, totalSamples])

  const onZoomFit = useCallback(() => {
    zoomLevelRef.current = 1
    viewStartSampleRef.current = 0
    recalculateVisiblePeaks()
  }, [recalculateVisiblePeaks])

  const resetViewport = useCallback(() => {
    zoomLevelRef.current = 1
    viewStartSampleRef.current = 0
  }, [])

  return {
    canvasRevision,
    visiblePeaksRef,
    canvasWidthRef,
    zoomLevelRef,
    viewStartSampleRef,
    samplesPerPixelRef,
    recalculateVisiblePeaks,
    resetViewport,
    bumpCanvasRevision,
    onResize,
    onWheel,
    onZoomIn,
    onZoomOut,
    onZoomFit,
  }
}
