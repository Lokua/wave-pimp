import { forwardRef, useEffect, useRef, useState } from 'react'
import styled from '@emotion/styled'

import type { AudioFile, Settings, VisiblePeaks } from './types'
import { formatDuration, formatSize } from './util'
import {
  Canvas as WaveformCanvas,
  getVisiblePeaksFromCache,
} from './WaveEditor'
import useAudioPlayback from './useAudioPlayback'
import IconButton from './components/IconButton'
import Toast from './components/Toast'
import useToast from './components/useToast'
import { useSaveWav } from './export'

const Card = styled.article<{ isSelected: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
  padding: 16px;
  gap: 12px;
  border: ${({ isSelected }) =>
    isSelected ? '1px solid transparent' : '1px solid var(--border-color)'};
  box-shadow: ${({ isSelected }) =>
    isSelected ? '0 0 0 2px var(--text-color)' : 'none'};
  border-radius: 2px;
  background: var(--bg-controls);
`

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`

const Actions = styled.div`
  display: flex;
  gap: 8px;
`

const RenameOverlay = styled.div`
  position: absolute;
  inset: 12px;
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 6px;
  background: var(--bg-controls);
  border: 1px solid var(--border-color);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.18);
  z-index: 2;
`

const RenameRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const RenameHeader = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
`

const CloseButton = styled(IconButton)`
  /* padding: 2px; */
`

const RenameInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-color);
  font-size: 13px;
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
  id?: string
  file: AudioFile
  settings: Settings
  audioContext: AudioContext
  isSelected: boolean
  shouldRename: boolean
  renameSignal: number
  onSelect: () => void
  onEdit: (file: AudioFile) => void
  onRemove: (fileId: string) => void
  onUpdateFile: (next: AudioFile) => void
}

const MAX_CACHE_WIDTH = 7680
// const MAX_CACHE_WIDTH = window.screen.width

const WaveCard = forwardRef<HTMLElement, WaveCardProps>(function WaveCard(
  {
    id,
    file,
    settings,
    audioContext,
    isSelected,
    shouldRename,
    renameSignal,
    onSelect,
    onEdit,
    onRemove,
    onUpdateFile,
  },
  ref,
) {
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [samplesPerPixel, setSamplesPerPixel] = useState(1)
  const [visiblePeaks, setVisiblePeaks] = useState<VisiblePeaks>({
    visibleMinPerChannel: [],
    visibleMaxPerChannel: [],
  })
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(file.name)

  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer: file.audioBuffer,
  })
  const samplesPerPixelRef = useRef(samplesPerPixel)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const renameSignalRef = useRef(renameSignal)
  const { message: toastMessage, showToast } = useToast()
  const { saveWav: saveFile } = useSaveWav({
    file,
    settings,
    audioBuffer: file.audioBuffer,
    onUpdateFile,
    showToast,
  })

  const nChannels = 1
  const sampleRate = file.audioBuffer.sampleRate
  const totalSamples = file.audioBuffer.getChannelData(0).length

  const [peaksCache, setPeaksCache] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function buildPeaksAsync() {
      const label = file.name
      console.time(`[PERF] "${label}" buildPeaksCache (WaveCard)`)
      try {
        const channelData = []
        for (let i = 0; i < file.audioBuffer.numberOfChannels; i++) {
          channelData.push(file.audioBuffer.getChannelData(i))
        }
        const result = await window.electron.invoke('build-peaks-cache', {
          channelData,
          maxCacheWidth: MAX_CACHE_WIDTH,
          options: {
            onlyLowestLevel: true,
          },
        })
        if (!cancelled) {
          setPeaksCache(result.peaksCache)
          console.timeEnd(`[PERF] "${label}" buildPeaksCache (WaveCard)`)
        }
      } catch (error) {
        console.error('Failed to build peaks cache:', error)
      }
    }
    buildPeaksAsync()
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    playbackRef.current.stop()
    playbackRef.current.setBuffer(file.audioBuffer)
  }, [file.audioBuffer, playbackRef])

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(file.name)
    }
  }, [file.name, isRenaming])

  useEffect(() => {
    if (!isRenaming) return
    setDraftName(file.name)
    const raf = requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
    return () => cancelAnimationFrame(raf)
  }, [file.name, isRenaming])

  useEffect(() => {
    if (!shouldRename) {
      renameSignalRef.current = renameSignal
      return
    }
    if (renameSignalRef.current === renameSignal) return
    renameSignalRef.current = renameSignal
    setIsRenaming(true)
  }, [renameSignal, shouldRename])

  useEffect(() => {
    samplesPerPixelRef.current = samplesPerPixel
  }, [samplesPerPixel])

  useEffect(() => {
    if (canvasWidth <= 0 || !peaksCache) return
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
    if (playbackState.isPlaying) {
      playbackRef.current.stop()
      playbackRef.current.play({
        fromSeconds: 0,
      })
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

  function onClickEdit() {
    onEdit(file)
  }

  function onClickRemove(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onRemove(file.id)
  }

  function ensureWavExtension(name: string) {
    return name.toLowerCase().endsWith('.wav') ? name : `${name}.wav`
  }

  function getFileNameFromPath(filePath: string) {
    return filePath.split(/[\\/]/).pop() ?? filePath
  }

  function replaceFileNameInPath(filePath: string, nextName: string) {
    const parts = filePath.split(/[\\/]/)
    parts[parts.length - 1] = nextName
    return parts.join(filePath.includes('\\') ? '\\' : '/')
  }

  async function saveWav() {
    const trimmedName = draftName.trim()
    const desiredName = ensureWavExtension(trimmedName || file.name)
    const defaultPath = file.filePath
      ? replaceFileNameInPath(file.filePath, desiredName)
      : desiredName
    const resultPath = await saveFile({
      forceDialog: true,
      defaultPath,
      toastLabel: 'Saved As',
      updateFileFromPath: true,
    })
    if (!resultPath) return
    const nextName = getFileNameFromPath(resultPath)
    setDraftName(nextName)
    setIsRenaming(false)
  }

  function onDoubleClickTitle(event: React.MouseEvent) {
    event.stopPropagation()
    setIsRenaming(true)
  }

  function onRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      setIsRenaming(false)
      setDraftName(file.name)
    }
  }

  function onResizeCanvas(size: { width: number }) {
    setCanvasWidth(size.width)
  }

  return (
    <Card
      id={id}
      isSelected={isSelected}
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      ref={ref}
      data-wave-card="true"
    >
      <Title onDoubleClick={onDoubleClickTitle}>{file.name}</Title>
      <Actions>
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
        <IconButton
          type="button"
          name="Close"
          aria-label="Remove from sidebar"
          title="Remove from sidebar"
          onClick={onClickRemove}
          style={{ marginLeft: 'auto' }}
        />
        <IconButton
          type="button"
          name="Edit"
          aria-label="Load in editor"
          title="Load in editor (Enter)"
          onClick={onClickEdit}
        />
      </Actions>
      <WaveformCanvas
        nChannels={nChannels}
        visiblePeaks={visiblePeaks}
        viewStartSample={0}
        samplesPerPixel={samplesPerPixel}
        canvasRevision={0}
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
      {isRenaming ? (
        <RenameOverlay
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <RenameHeader>
            <CloseButton
              type="button"
              name="Close"
              aria-label="Close"
              title="Cancel rename (Esc)"
              onClick={() => {
                setIsRenaming(false)
                setDraftName(file.name)
              }}
            />
          </RenameHeader>
          <RenameRow>
            <RenameInput
              ref={renameInputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={onRenameKeyDown}
              aria-label="File name"
            />
            <IconButton
              type="button"
              name="SaveAs"
              aria-label="Save As"
              title="Save As"
              onClick={saveWav}
            />
          </RenameRow>
        </RenameOverlay>
      ) : null}
      <Toast message={toastMessage} />
    </Card>
  )
})

export default WaveCard
