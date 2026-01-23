import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import styled from '@emotion/styled'

import type { AudioFile, Settings, VisiblePeaks } from './types'
import { formatDuration, formatSize } from './util'
import WaveformCanvas from './WaveformCanvas'
import useAudioPlayback from './useAudioPlayback'
import { buildPeaksCache, getVisiblePeaksFromCache } from './waveformPeaks'
import IconButton from './IconButton'
import { encodeWavForSettings } from './wavExport'
import Toast from './Toast'
import useToast from './useToast'

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
  onUpdateFile: (next: AudioFile) => void
}

const MAX_CACHE_WIDTH = 7680

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

  const playback = useAudioPlayback({
    audioContext,
    closeOnUnmount: false,
  })
  const playbackRef = playback.playback
  const samplesPerPixelRef = useRef(samplesPerPixel)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const renameSignalRef = useRef(renameSignal)
  const { message: toastMessage, showToast } = useToast()

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
      playbackRef.current.play({
        fromSeconds: 0,
      })
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
    const bytes = await encodeWavForSettings(file.audioBuffer, settings)
    const defaultPath = file.filePath
      ? replaceFileNameInPath(file.filePath, desiredName)
      : desiredName
    const result = (await window.electron.invoke('save-wav', {
      bytes,
      path: undefined,
      defaultPath,
    })) as { canceled?: boolean; path?: string }

    if (!result || result.canceled || !result.path) return

    const nextName = getFileNameFromPath(result.path)
    onUpdateFile({
      ...file,
      filePath: result.path,
      name: nextName,
    })
    setDraftName(nextName)
    setIsRenaming(false)
    showToast('Saved As')
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
          name={playback.isPlaying ? 'Pause' : 'Stop'}
          aria-label={playback.isPlaying ? 'Pause' : 'Stop'}
          title={playback.isPlaying ? 'Pause' : 'Stop'}
          onClick={onClickStop}
        />
        <IconButton
          type="button"
          name="Edit"
          aria-label="Edit"
          title="Open editor (Enter)"
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
