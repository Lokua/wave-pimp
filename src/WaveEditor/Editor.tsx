import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'

import type { AudioFile, SelectionRange, Settings } from '../types'
import Canvas from './Canvas'
import Toast from '../components/Toast'
import useToast from '../components/useToast'
import { useSaveWav } from '../export'
import WaveEditorControls from './Controls'
import useEdits from './useEdits'
import useEditorPlayback from './useEditorPlayback'
import useSelection from './useSelection'
import useViewport from './useViewport'

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

const MAX_CACHE_WIDTH = 7680

type WaveEditorProps = {
  file: AudioFile
  settings: Settings
  audioContext: AudioContext
  onBack: () => void
  onUpdateFile: (next: AudioFile) => void
}

export default function Editor({
  file,
  settings,
  audioContext,
  onBack,
  onUpdateFile,
}: WaveEditorProps) {
  const audioBuffer = file.audioBuffer
  const { message: toastMessage, showToast } = useToast()
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

  useEffect(() => {
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
  }, [
    audioBuffer,
    playbackRef,
    recalculateVisiblePeaks,
    resetViewport,
    setSelection,
  ])

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

  function onClickSelectToStart() {
    const cursorSample = getCursorSample() ?? 0
    setSelection({ startSample: 0, endSample: cursorSample })
    seekToSample(0)
  }

  function onClickSelectToEnd() {
    const cursorSample = getCursorSample() ?? 0
    setSelection({ startSample: cursorSample, endSample: totalSamples })
    seekToSample(cursorSample)
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

  return (
    <>
      <WaveEditorControls
        isPlaying={isPlaying}
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
        onBack={onBack}
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
        </CanvasInteraction>
      </CanvasContainer>
      <Toast message={toastMessage} />
    </>
  )
}
