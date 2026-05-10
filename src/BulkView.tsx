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

  function readPcmSample(
    view: DataView,
    offset: number,
    audioFormat: number,
    bitDepth: number,
  ) {
    if (audioFormat === 3 && bitDepth === 32) {
      return view.getFloat32(offset, true)
    }

    if (audioFormat !== 1) {
      throw new Error(`Unsupported WAV format code ${audioFormat}`)
    }

    if (bitDepth === 8) {
      return (view.getUint8(offset) - 128) / 128
    }

    if (bitDepth === 16) {
      return view.getInt16(offset, true) / 32768
    }

    if (bitDepth === 24) {
      let value =
        view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16)
      if (value & 0x800000) value |= 0xff000000
      return value / 8388608
    }

    if (bitDepth === 32) {
      return view.getInt32(offset, true) / 2147483648
    }

    throw new Error(`Unsupported WAV bit depth ${bitDepth}`)
  }

  function renderMonoFromWavBytes(file: AudioFile) {
    if (!file.sourceBuffer) return null
    if (file.sourceBuffer.byteLength === 0) return null

    const view = new DataView(file.sourceBuffer)
    if (
      view.getUint32(0, false) !== 0x52494646 ||
      view.getUint32(8, false) !== 0x57415645
    ) {
      return null
    }

    let offset = 12
    let fmtOffset: number | null = null
    let dataOffset: number | null = null
    let dataSize = 0

    while (offset + 8 <= view.byteLength) {
      const chunkId = view.getUint32(offset, false)
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === 0x666d7420) fmtOffset = offset + 8
      if (chunkId === 0x64617461) {
        dataOffset = offset + 8
        dataSize = chunkSize
      }
      offset += 8 + chunkSize + (chunkSize % 2)
    }

    if (fmtOffset == null || dataOffset == null) return null

    const audioFormat = view.getUint16(fmtOffset, true)
    const channelCount = view.getUint16(fmtOffset + 2, true)
    const sampleRate = view.getUint32(fmtOffset + 4, true)
    const blockAlign = view.getUint16(fmtOffset + 12, true)
    const bitDepth = view.getUint16(fmtOffset + 14, true)
    if (sampleRate !== settings.sampleRate) return null

    const sampleCount = dataSize / blockAlign
    if (!Number.isInteger(sampleCount)) {
      throw new Error(`${file.name} has malformed WAV data`)
    }

    const outputBuffer = audioContext.createBuffer(
      1,
      sampleCount,
      sampleRate,
    )
    const output = outputBuffer.getChannelData(0)
    const bytesPerSample = bitDepth / 8

    for (let i = 0; i < sampleCount; i++) {
      const frameOffset = dataOffset + i * blockAlign
      let sum = 0
      for (let channel = 0; channel < channelCount; channel++) {
        sum += readPcmSample(
          view,
          frameOffset + channel * bytesPerSample,
          audioFormat,
          bitDepth,
        )
      }
      output[i] = sum / channelCount
    }

    return outputBuffer
  }

  async function renderMonoAtTargetRate(file: AudioFile) {
    const sourceBytesBuffer = renderMonoFromWavBytes(file)
    if (sourceBytesBuffer) return sourceBytesBuffer

    const sourceBuffer = file.audioBuffer
    if (sourceBuffer.sampleRate === settings.sampleRate) {
      const targetLength = file.sampleCount ?? sourceBuffer.length
      const outputBuffer = audioContext.createBuffer(
        1,
        targetLength,
        settings.sampleRate,
      )
      const output = outputBuffer.getChannelData(0)
      const copyLength = Math.min(sourceBuffer.length, targetLength)

      for (
        let channel = 0;
        channel < sourceBuffer.numberOfChannels;
        channel++
      ) {
        const input = sourceBuffer.getChannelData(channel)
        for (let i = 0; i < copyLength; i++) {
          output[i] += input[i] / sourceBuffer.numberOfChannels
        }
        const lastSample = input[Math.max(0, copyLength - 1)] ?? 0
        for (let i = copyLength; i < targetLength; i++) {
          output[i] += lastSample / sourceBuffer.numberOfChannels
        }
      }

      return outputBuffer
    }

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
          {isProcessing ? 'Concatenating...' : 'Concat'}
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
