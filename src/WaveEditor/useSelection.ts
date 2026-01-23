import { useCallback, useRef } from 'react'

import type { SelectionRange } from '../types'

type UseSelectionArgs = {
  audioBuffer: AudioBuffer
  selectionRef: React.RefObject<SelectionRange>
  viewStartSampleRef: React.RefObject<number>
  samplesPerPixelRef: React.RefObject<number>
  canvasWidthRef: React.RefObject<number>
  recalculateVisiblePeaks: () => void
  bumpCanvasRevision: () => void
  seekToSample: (sample: number) => void
}

export default function useSelection({
  audioBuffer,
  selectionRef,
  viewStartSampleRef,
  samplesPerPixelRef,
  canvasWidthRef,
  recalculateVisiblePeaks,
  bumpCanvasRevision,
  seekToSample,
}: UseSelectionArgs) {
  const isSelectingRef = useRef(false)
  const autoScrollIntervalRef = useRef<number | null>(null)
  const lastMouseXRef = useRef(0)
  const justCompletedSelectionRef = useRef(false)
  const canvasRectRef = useRef<DOMRect | null>(null)

  const setSelection = useCallback(
    (next: SelectionRange) => {
      selectionRef.current = next
      bumpCanvasRevision()
    },
    [bumpCanvasRevision, selectionRef],
  )

  function onClickCanvas(event: React.MouseEvent<HTMLDivElement>) {
    if (event.shiftKey) return
    if (justCompletedSelectionRef.current) {
      justCompletedSelectionRef.current = false
      return
    }

    const x = event.nativeEvent.offsetX
    const clickedSample = Math.floor(
      viewStartSampleRef.current + x * samplesPerPixelRef.current,
    )
    seekToSample(clickedSample)
  }

  function onMouseDown(event: React.MouseEvent<HTMLDivElement>) {
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
        setSelection({
          startSample: selectionRef.current.startSample,
          endSample: Math.floor(
            viewStartSampleRef.current + clampedMouseX * currentSamplesPerPixel,
          ),
        })
      }, 16)
    }
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
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
        seekToSample(startSample)
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

  return {
    selectionRef,
    setSelection,
    onClickCanvas,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
  }
}
