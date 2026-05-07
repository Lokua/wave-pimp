import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'

import type { AudioFile, Settings } from './types'
import WaveGrid from './WaveGrid'
import { encodeWav } from './export'

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
`

const ToolbarLabel = styled.span`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
`

const FormatLabel = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  opacity: 0.7;
`

const NoticeStack = styled.div`
  display: grid;
  gap: 8px;
  padding: 12px 12px 0;
`

const Notice = styled.div<{ tone: 'warning' | 'error' }>`
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid
    ${({ tone }) =>
      tone === 'error' ? 'var(--text-color)' : 'var(--border-color)'};
  background: ${({ tone }) =>
    tone === 'error' ? 'var(--bg-controls)' : 'var(--bg-main)'};
  box-shadow: ${({ tone }) =>
    tone === 'error' ? '0 0 0 1px var(--text-color)' : 'none'};
`

const NoticeTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
`

const NoticeBody = styled.div`
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.85;
`

const Spacer = styled.div`
  flex: 1;
`

const ConcatButton = styled.button`
  flex-shrink: 0;
  padding: 6px 10px;

  &:not(:disabled):hover {
    border-color: var(--text-color);
    background: var(--button-bg);
  }

  &:disabled {
    border-color: var(--border-color);
    background: var(--button-hover);
    color: var(--text-color);
    cursor: not-allowed;
    opacity: 0.45;
  }
`

const Body = styled.div<{ isDisabled: boolean }>`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  pointer-events: ${({ isDisabled }) => (isDisabled ? 'none' : 'auto')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.55 : 1)};
`

type BulkViewProps = {
  files: AudioFile[]
  settings: Settings
  audioContext: AudioContext
  selectedIds: string[]
  onToggleSelection: (fileId: string) => void
  onProcessingChange: (isProcessing: boolean) => void
  onConcatComplete: (file: AudioFile) => void
  onUpdateFile: (next: AudioFile) => void
  onRemoveFile: (fileId: string) => void
  onEditFile: (file: AudioFile) => void
}

export default function BulkView({
  files,
  settings,
  audioContext,
  selectedIds,
  onToggleSelection,
  onProcessingChange,
  onConcatComplete,
  onUpdateFile,
  onRemoveFile,
  onEditFile,
}: BulkViewProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedCount = selectedIds.length
  const selectedFiles = useMemo(() => {
    const filesById = new Map(files.map((file) => [file.id, file]))
    return selectedIds.flatMap((id) => {
      const file = filesById.get(id)
      return file ? [file] : []
    })
  }, [files, selectedIds])
  const sampleLengths = useMemo(() => {
    return selectedFiles.map(
      (file) => file.sampleCount ?? file.audioBuffer.length,
    )
  }, [selectedFiles])
  const distinctSampleLengths = [...new Set(sampleLengths)]
  const hasLengthMismatch = distinctSampleLengths.length > 1
  const isConcatDisabled = selectedCount <= 1 || isProcessing
  const disabledTitle =
    selectedCount <= 1 ? 'Select more than 1 card' : 'Concat in progress'

  useEffect(() => {
    onProcessingChange(isProcessing)
    return () => {
      onProcessingChange(false)
    }
  }, [isProcessing, onProcessingChange])

  function getDefaultPath() {
    const firstFile = selectedFiles[0]
    if (!firstFile?.filePath) return 'wavetable.wav'
    return firstFile.filePath.replace(/[^\\/]*$/, 'wavetable.wav')
  }

  function getFileNameFromPath(filePath: string) {
    return filePath.split(/[\\/]/).pop() ?? filePath
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message
    return 'Concat failed. Selection is unchanged; try again.'
  }

  async function renderMonoAtTargetRate(file: AudioFile) {
    const sourceBuffer = file.audioBuffer
    const targetLength = Math.max(
      1,
      Math.round(sourceBuffer.duration * settings.sampleRate),
    )
    const offlineContext = new OfflineAudioContext(
      1,
      targetLength,
      settings.sampleRate,
    )
    const source = offlineContext.createBufferSource()
    source.buffer = sourceBuffer
    source.connect(offlineContext.destination)
    source.start(0)
    return await offlineContext.startRendering()
  }

  async function concatIntoWavetable() {
    if (isConcatDisabled) return

    let completed = false
    setErrorMessage(null)
    setIsProcessing(true)
    try {
      const renderedBuffers = await Promise.all(
        selectedFiles.map(renderMonoAtTargetRate),
      )
      const totalLength = renderedBuffers.reduce(
        (sum, buffer) => sum + buffer.length,
        0,
      )
      const outputBuffer = audioContext.createBuffer(
        1,
        totalLength,
        settings.sampleRate,
      )
      const outputData = outputBuffer.getChannelData(0)
      let offset = 0
      for (const buffer of renderedBuffers) {
        outputData.set(buffer.getChannelData(0), offset)
        offset += buffer.length
      }

      const bytes = encodeWav(outputBuffer, settings.bitDepth)
      const result = (await window.electron.invoke('save-wav', {
        bytes,
        defaultPath: getDefaultPath(),
      })) as { canceled?: boolean; path?: string }
      if (!result || result.canceled || !result.path) return

      completed = true
      onConcatComplete({
        id: crypto.randomUUID(),
        name: getFileNameFromPath(result.path),
        filePath: result.path,
        size: bytes.byteLength,
        type: 'audio/wav',
        duration: outputBuffer.duration,
        sampleRate: outputBuffer.sampleRate,
        bitDepth: settings.bitDepth,
        channels: outputBuffer.numberOfChannels,
        sampleCount: outputBuffer.length,
        audioBuffer: outputBuffer,
      })
    } catch (error) {
      console.error('Failed to concat wavetable:', error)
      setErrorMessage(getErrorMessage(error))
    } finally {
      if (!completed) {
        setIsProcessing(false)
      }
    }
  }

  return (
    <Container>
      <Toolbar>
        <ToolbarLabel>{selectedCount} selected</ToolbarLabel>
        <FormatLabel>
          Exportable as {settings.bitDepth}-bit /{' '}
          {(settings.sampleRate / 1000).toLocaleString()} kHz
        </FormatLabel>
        <Spacer />
        <ConcatButton
          type="button"
          disabled={isConcatDisabled}
          title={isConcatDisabled ? disabledTitle : undefined}
          onClick={() => void concatIntoWavetable()}
        >
          {isProcessing ? 'Concatenating...' : 'Concat into Wavetable'}
        </ConcatButton>
      </Toolbar>
      {hasLengthMismatch || errorMessage ? (
        <NoticeStack>
          {errorMessage ? (
            <Notice tone="error" role="alert">
              <NoticeTitle>Concat failed</NoticeTitle>
              <NoticeBody>{errorMessage}</NoticeBody>
            </Notice>
          ) : null}
          {hasLengthMismatch ? (
            <Notice tone="warning">
              <NoticeTitle>
                Selected files have different sample counts
              </NoticeTitle>
              <NoticeBody>
                Observed source lengths:{' '}
                {distinctSampleLengths
                  .map((length) => `${length.toLocaleString()} samples`)
                  .join(', ')}
                . Wavetable players typically require uniform frame size.
              </NoticeBody>
            </Notice>
          ) : null}
        </NoticeStack>
      ) : null}
      <Body isDisabled={isProcessing} aria-busy={isProcessing}>
        <WaveGrid
          files={files}
          selectedId={null}
          settings={settings}
          audioContext={audioContext}
          layout="grid"
          isBulkMode
          bulkSelection={selectedIds}
          isDisabled={isProcessing}
          showCardEditAction
          onSelect={onToggleSelection}
          onEdit={onEditFile}
          onRemove={onRemoveFile}
          onUpdateFile={onUpdateFile}
        />
      </Body>
    </Container>
  )
}
