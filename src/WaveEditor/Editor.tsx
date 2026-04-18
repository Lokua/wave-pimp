import styled from '@emotion/styled'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AudioFile, SelectionRange, Settings } from '../types'
import Canvas from './Canvas'
import Toast from '../components/Toast'
import useToast from '../components/useToast'
import { useSaveWav } from '../export'
import { isMac } from '../util'
import WaveEditorControls from './Controls'
import useEdits from './useEdits'
import useEditorPlayback from './useEditorPlayback'
import useSelection from './useSelection'
import useViewport from './useViewport'
import InfoPanel from './InfoPanel'

const CanvasContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px 8px 12px;
  overflow: hidden;
`

const CanvasInteraction = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
`

const LoadingOverlay = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-color);
  opacity: 0.7;
  background: var(--bg-canvas);
  border: 1px solid var(--border-canvas);
`

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--text-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

// const MAX_CACHE_WIDTH = 7680
const MAX_CACHE_WIDTH = window.screen.width

type WaveEditorProps = {
  file: AudioFile
  settings: Settings
  audioContext: AudioContext
  isSidebarVisible: boolean
  onToggleSidebar: () => void
  onUpdateFile: (next: AudioFile) => void
}

export default function Editor({
  file,
  settings,
  audioContext,
  isSidebarVisible,
  onToggleSidebar,
  onUpdateFile,
}: WaveEditorProps) {
  const audioBuffer = file.audioBuffer
  const { message: toastMessage, showToast } = useToast()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const { saveWav } = useSaveWav({
    file,
    settings,
    audioBuffer,
    onUpdateFile,
    showToast,
  })
  const selectionRef = useRef<SelectionRange>({
    startSample: null,
    endSample: null,
  })
  const preserveSelectionOnNextBufferRef = useRef(false)

  const nChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const durationSeconds = audioBuffer.duration
  const totalSamples = audioBuffer.getChannelData(0).length

  const {
    playbackRef,
    isPlaying,
    onClickPlay,
    onClickStop,
    getCursorSample,
    seekToSample,
  } = useEditorPlayback({
    audioContext,
    audioBuffer,
    sampleRate,
    selectionRef,
  })

  const {
    canvasRevision,
    isLoadingPeaks,
    visiblePeaksRef,
    canvasWidthRef,
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
    canZoomIn,
    canZoomOut,
  } = useViewport({
    audioBuffer,
    maxCacheWidth: MAX_CACHE_WIDTH,
    getCursorSample,
  })

  const {
    setSelection,
    onClickCanvas,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  } = useSelection({
    audioBuffer,
    selectionRef,
    viewStartSampleRef,
    samplesPerPixelRef,
    canvasWidthRef,
    recalculateVisiblePeaks,
    bumpCanvasRevision,
    seekToSample,
  })

  const { crop, trim, fadeIn, fadeOut, normalize } = useEdits({
    file,
    audioContext,
    audioBuffer,
    nChannels,
    sampleRate,
    selectionRef,
    isPlaying,
    playbackRef,
    onUpdateFile,
    resetSelection: () => {
      setSelection({
        startSample: null,
        endSample: null,
      })
    },
    resetViewport,
    recalculateVisiblePeaks,
    bumpCanvasRevision,
    setPreserveSelectionOnNextBuffer: (value: boolean) => {
      preserveSelectionOnNextBufferRef.current = value
    },
  })

  useEffect(
    function onMount() {
      console.time('[PERF] Editor mount')
      const preserveSelection = preserveSelectionOnNextBufferRef.current
      preserveSelectionOnNextBufferRef.current = false
      playbackRef.current.stop()
      playbackRef.current.setBuffer(audioBuffer)
      if (!preserveSelection) {
        resetViewport()
        setSelection({
          startSample: null,
          endSample: null,
        })
      }
      recalculateVisiblePeaks()
      console.timeEnd('[PERF] Editor mount')
    },
    [
      audioBuffer,
      playbackRef,
      recalculateVisiblePeaks,
      resetViewport,
      setSelection,
    ],
  )

  useEffect(
    function onPlayback() {
      let frame = 0
      const updateElapsed = () => {
        setElapsedSeconds(playbackRef.current.getCurrentTimeSeconds())
        frame = requestAnimationFrame(updateElapsed)
      }

      if (isPlaying) {
        frame = requestAnimationFrame(updateElapsed)
        return () => {
          cancelAnimationFrame(frame)
        }
      }

      setElapsedSeconds(playbackRef.current.getCurrentTimeSeconds())
      return () => {
        if (frame) {
          cancelAnimationFrame(frame)
        }
      }
    },
    [isPlaying, playbackRef, audioBuffer],
  )

  const onClickSelectToStart = useCallback(() => {
    const cursorSample = getCursorSample() ?? 0
    setSelection({
      startSample: 0,
      endSample: cursorSample,
    })
    seekToSample(0)
  }, [getCursorSample, seekToSample, setSelection])

  const onClickSelectToEnd = useCallback(() => {
    const cursorSample = getCursorSample() ?? 0
    setSelection({
      startSample: cursorSample,
      endSample: totalSamples,
    })
    seekToSample(cursorSample)
  }, [getCursorSample, seekToSample, setSelection, totalSamples])

  const onClickSave = useCallback(() => {
    const forceDialog = !file.filePath
    void saveWav({
      forceDialog,
      toastLabel: 'Saved',
    })
  }, [file.filePath, saveWav])

  const onClickSaveAs = useCallback(() => {
    void saveWav({
      forceDialog: true,
      toastLabel: 'Saved As',
    })
  }, [saveWav])

  useEffect(
    function setupKeyboardShortcuts() {
      function isEditableTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement)) return false
        return (
          target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        )
      }

      function onKeyDown(event: KeyboardEvent) {
        if (isEditableTarget(event.target)) return

        const key = event.code === 'Space' ? 'space' : event.key.toLowerCase()
        const isMetaKey = isMac ? event.metaKey : event.ctrlKey
        const hasModifier = event.metaKey || event.ctrlKey || event.altKey

        switch (key) {
          case '\\':
            if (!isMetaKey) return
            event.preventDefault()
            onToggleSidebar()
            return
          case 'arrowleft':
            if (!isMetaKey) return
            event.preventDefault()
            onClickSelectToStart()
            return
          case 'arrowright':
            if (!isMetaKey) return
            event.preventDefault()
            onClickSelectToEnd()
            return
          case 's':
            if (!isMetaKey) return
            event.preventDefault()
            if (event.shiftKey) {
              onClickSaveAs()
            } else {
              onClickSave()
            }
            return
          case 'space':
            if (hasModifier) return
            event.preventDefault()
            if (isPlaying) {
              onClickStop()
            } else {
              onClickPlay()
            }
            return
          case '[':
            if (hasModifier) return
            if (!canZoomOut) return
            event.preventDefault()
            onZoomOut()
            return
          case ']':
            if (hasModifier) return
            if (!canZoomIn) return
            event.preventDefault()
            onZoomIn()
            return
          case 'x':
            if (hasModifier) return
            event.preventDefault()
            trim()
            return
          case 'k':
            if (hasModifier) return
            event.preventDefault()
            crop()
            return
          case 'f':
            if (hasModifier) return
            event.preventDefault()
            fadeIn()
            return
          case 'v':
            if (hasModifier) return
            event.preventDefault()
            fadeOut()
            return
          case 'n':
            if (hasModifier) return
            event.preventDefault()
            normalize()
            return
          default:
            return
        }
      }

      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    [
      canZoomIn,
      canZoomOut,
      crop,
      fadeIn,
      fadeOut,
      isPlaying,
      normalize,
      onClickPlay,
      onClickSave,
      onClickSaveAs,
      onClickStop,
      onClickSelectToEnd,
      onClickSelectToStart,
      onToggleSidebar,
      onZoomIn,
      onZoomOut,
      trim,
    ],
  )

  return (
    <>
      <WaveEditorControls
        isPlaying={isPlaying}
        elapsedSeconds={elapsedSeconds}
        durationSeconds={durationSeconds}
        onClickPlay={onClickPlay}
        onClickStop={onClickStop}
        onClickZoomIn={onZoomIn}
        onClickZoomOut={onZoomOut}
        onClickZoomFit={onZoomFit}
        onClickSelectToStart={onClickSelectToStart}
        onClickSelectToEnd={onClickSelectToEnd}
        onClickCrop={crop}
        onClickTrim={trim}
        onClickFadeIn={fadeIn}
        onClickFadeOut={fadeOut}
        onClickNormalize={normalize}
        onClickSave={onClickSave}
        onClickSaveAs={onClickSaveAs}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={onToggleSidebar}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
      />
      <CanvasContainer>
        <CanvasInteraction
          onClick={onClickCanvas}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onWheel={onWheel}
        >
          {isLoadingPeaks ? (
            <LoadingOverlay>
              <LoadingSpinner />
              <div>Loading waveform...</div>
            </LoadingOverlay>
          ) : (
            <Canvas
              nChannels={nChannels}
              visiblePeaks={visiblePeaksRef.current}
              viewStartSample={viewStartSampleRef.current}
              samplesPerPixel={samplesPerPixelRef.current}
              selection={selectionRef.current}
              canvasRevision={canvasRevision}
              getCursorSample={getCursorSample}
              onResize={onResize}
            />
          )}
        </CanvasInteraction>
      </CanvasContainer>
      <InfoPanel file={file} samplesPerPixel={samplesPerPixelRef.current} />
      <Toast message={toastMessage} />
    </>
  )
}
