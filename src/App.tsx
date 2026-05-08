import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'
import { parseBlob } from 'music-metadata'

import BulkView from './BulkView'
import GenerateView from './GenerateView'
import SettingsModal from './SettingsModal'
import WaveEditor from './WaveEditor'
import type { AudioFile, Settings } from './types'
import type { PhaseMode } from './GenerateView'
import useDropArea from './useDropArea'

const audioCtx = new AudioContext()

type Workspace = 'files' | 'generate' | 'edit'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`

const Titlebar = styled.div`
  -webkit-app-region: drag;
  -webkit-user-select: none;
  position: sticky;
  top: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-left: 80px;
  padding-right: 80px;
  flex-shrink: 0;
  height: 36px;
  user-select: none;
  background: var(--bg-main);
  z-index: 10;
`

const TitlebarNav = styled.nav`
  -webkit-app-region: no-drag;
  position: absolute;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

const NavButton = styled.button<{ isActive: boolean }>`
  padding: 4px 6px 5px;
  border: 0;
  border-bottom: 2px solid
    ${({ isActive }) => (isActive ? 'var(--text-color)' : 'transparent')};
  background: transparent;
  font-size: 12px;

  &:hover {
    background: transparent;
    border-bottom-color: var(--separator-color);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

const TitlebarFileName = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Shell = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 6px 12px 0;
`

const WorkspacePane = styled.section<{ isDragActive: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: ${({ isDragActive }) =>
    isDragActive ? '2px dashed var(--text-color)' : '0 solid transparent'};
  background: ${({ isDragActive }) =>
    isDragActive ? 'rgba(100, 149, 237, 0.12)' : 'transparent'};
`

const WorkspaceEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
`

const FilesEmpty = styled(WorkspaceEmpty)``

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 12px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-color);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
  z-index: 5;
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

function getIncomingFileKey(file: File) {
  const filePath = (file as File & { path?: string }).path
  if (filePath) return `path:${filePath}`
  return `meta:${file.name}|${file.size}|${file.type}|${file.lastModified}`
}

function getAudioFileKey(file: AudioFile) {
  if (file.filePath) return `path:${file.filePath}`
  return `meta:${file.name}|${file.size}|${file.type}`
}

export default function App() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [editorFileId, setEditorFileId] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] =
    useState<Workspace>('files')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [filesSelection, setFilesSelection] = useState<string[]>([])
  const [isFilesProcessing, setIsFilesProcessing] = useState(false)
  const [nextFrameNumber, setNextFrameNumber] = useState(1)
  const [harmonicCount, setHarmonicCount] = useState(1)
  const [rolloff, setRolloff] = useState(1)
  const [oddEvenBalance, setOddEvenBalance] = useState(0)
  const [phaseMode, setPhaseMode] = useState<PhaseMode>('aligned')
  const [settings, setSettings] = useState<Settings>({
    sampleRate: 48000,
    bitDepth: 24,
  })
  const { isDragActive, eventHandlers } = useDropArea(async (droppedFiles) => {
    if (droppedFiles.length === 0) {
      return
    }

    const existingKeys = new Set(files.map(getAudioFileKey))
    const seenIncomingKeys = new Set<string>()
    const incomingUniqueFiles: File[] = []
    for (const file of droppedFiles) {
      const key = getIncomingFileKey(file)
      if (existingKeys.has(key) || seenIncomingKeys.has(key)) continue
      seenIncomingKeys.add(key)
      incomingUniqueFiles.push(file)
    }
    if (incomingUniqueFiles.length === 0) {
      return
    }

    // console.time('[PERF] Total file drop')
    // console.log(
    //   `[PERF] Starting file drop for ${incomingUniqueFiles.length} file(s)`,
    // )

    setIsLoadingFiles(true)
    try {
      const decodedFiles = await Promise.all(
        incomingUniqueFiles.map(async (file) => {
          // const fileLabel = `[PERF] "${file.name}"`
          // console.log(
          //   `${fileLabel} - ${(file.size / 1024 / 1024).toFixed(2)} MB`,
          // )

          const metadata = await parseBlob(file)
          const filePath = (file as File & { path?: string }).path
          if (
            metadata.format.duration == null ||
            metadata.format.sampleRate == null ||
            metadata.format.bitsPerSample == null ||
            metadata.format.numberOfChannels == null
          ) {
            throw new Error('Invalid or unsupported audio file')
          }

          const buffer = await file.arrayBuffer()

          // console.time(`${fileLabel} - Audio decoding`)
          const audioBuffer = await audioCtx.decodeAudioData(buffer)
          // console.timeEnd(`${fileLabel} - Audio decoding`)

          return {
            id: crypto.randomUUID(),
            name: file.name,
            filePath,
            size: file.size,
            type: file.type,
            duration: metadata.format.duration,
            sampleRate: metadata.format.sampleRate,
            bitDepth: metadata.format.bitsPerSample,
            channels: metadata.format.numberOfChannels,
            sampleCount:
              metadata.format.numberOfSamples ?? audioBuffer.length,
            buffer,
            audioBuffer,
          }
        }),
      )

      setFiles((prev) => {
        const keys = new Set(prev.map(getAudioFileKey))
        const toAppend = decodedFiles.filter((item) => {
          const key = getAudioFileKey(item)
          if (keys.has(key)) return false
          keys.add(key)
          return true
        })
        return [...prev, ...toAppend]
      })
    } finally {
      setIsLoadingFiles(false)
      // console.timeEnd('[PERF] Total file drop')
    }
  })

  function openInEditor(file: AudioFile) {
    setEditorFileId(file.id)
    setSelectedFileId(file.id)
    setActiveWorkspace('edit')
  }

  function openEditWorkspace() {
    if (selectedFileId) {
      setEditorFileId(selectedFileId)
    }
    setActiveWorkspace('edit')
  }

  function toggleFilesSelection(fileId: string) {
    setFilesSelection((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId)
      }
      return [...prev, fileId]
    })
  }

  function completeFilesConcat(file: AudioFile) {
    setFiles((prev) => [...prev, file])
    setEditorFileId(file.id)
    setSelectedFileId(file.id)
    setFilesSelection([])
    setIsFilesProcessing(false)
    setActiveWorkspace('edit')
  }

  function addGeneratedFile(file: AudioFile) {
    setFiles((prev) => [...prev, file])
    setSelectedFileId(file.id)
    setNextFrameNumber((prev) => prev + 1)
  }

  function updateFile(next: AudioFile) {
    setFiles((prev) => prev.map((item) => (item.id === next.id ? next : item)))
  }

  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((item) => item.id !== fileId))
    setFilesSelection((prev) => prev.filter((id) => id !== fileId))
    if (selectedFileId === fileId) setSelectedFileId(null)
    if (editorFileId === fileId) setEditorFileId(null)
  }

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(null)
      setEditorFileId(null)
      return
    }

    const firstFileId = files[0].id
    const hasSelectedFile =
      selectedFileId != null && files.some((item) => item.id === selectedFileId)
    const hasEditorFile =
      editorFileId != null && files.some((item) => item.id === editorFileId)

    if (!hasSelectedFile) setSelectedFileId(firstFileId)
    if (!hasEditorFile) setEditorFileId(firstFileId)
  }, [editorFileId, files, selectedFileId])

  const editorFile = useMemo(() => {
    if (!editorFileId) return null
    return files.find((item) => item.id === editorFileId) ?? null
  }, [editorFileId, files])

  useEffect(() => {
    function openSettings() {
      setIsSettingsOpen(true)
    }

    window.electron.on('open-settings', openSettings)
    return () => {
      window.electron.off('open-settings', openSettings)
    }
  }, [])

  function renderWorkspace() {
    if (activeWorkspace === 'files') {
      return files.length ? (
        <BulkView
          files={files}
          settings={settings}
          audioContext={audioCtx}
          selectedIds={filesSelection}
          onToggleSelection={toggleFilesSelection}
          onProcessingChange={setIsFilesProcessing}
          onConcatComplete={completeFilesConcat}
          onUpdateFile={updateFile}
          onRemoveFile={removeFile}
          onEditFile={openInEditor}
        />
      ) : (
        <FilesEmpty>Drop audio file(s) or generate a frame.</FilesEmpty>
      )
    }

    if (activeWorkspace === 'generate') {
      return (
        <GenerateView
          settings={settings}
          audioContext={audioCtx}
          nextFrameNumber={nextFrameNumber}
          harmonicCount={harmonicCount}
          rolloff={rolloff}
          oddEvenBalance={oddEvenBalance}
          phaseMode={phaseMode}
          onHarmonicCountChange={setHarmonicCount}
          onRolloffChange={setRolloff}
          onOddEvenBalanceChange={setOddEvenBalance}
          onPhaseModeChange={setPhaseMode}
          onAddFile={addGeneratedFile}
        />
      )
    }

    if (!editorFile) {
      return <WorkspaceEmpty>Select a file to edit.</WorkspaceEmpty>
    }

    return (
      <WaveEditor
        file={editorFile}
        settings={settings}
        audioContext={audioCtx}
        isSidebarVisible
        onToggleSidebar={() => undefined}
        showSidebarToggle={false}
        onUpdateFile={updateFile}
      />
    )
  }

  return (
    <Container>
      <Titlebar>
        {activeWorkspace === 'edit' && (
          <TitlebarFileName>{editorFile?.name ?? ''}</TitlebarFileName>
        )}
        <TitlebarNav aria-label="Tools">
          <NavButton
            type="button"
            isActive={activeWorkspace === 'files'}
            disabled={isFilesProcessing}
            onClick={() => setActiveWorkspace('files')}
          >
            Files
          </NavButton>
          <NavButton
            type="button"
            isActive={activeWorkspace === 'edit'}
            disabled={isFilesProcessing}
            onClick={openEditWorkspace}
          >
            Edit
          </NavButton>
          <NavButton
            type="button"
            isActive={activeWorkspace === 'generate'}
            disabled={isFilesProcessing}
            onClick={() => setActiveWorkspace('generate')}
          >
            Generate
          </NavButton>
        </TitlebarNav>
      </Titlebar>
      <Shell>
        <WorkspacePane isDragActive={isDragActive} {...eventHandlers}>
          {renderWorkspace()}
        </WorkspacePane>
        {isLoadingFiles ? (
          <LoadingOverlay>
            <LoadingSpinner />
            <div>Loading audio file(s)...</div>
          </LoadingOverlay>
        ) : null}
      </Shell>
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onChangeSettings={setSettings}
        onClose={() => {
          setIsSettingsOpen(false)
        }}
      />
    </Container>
  )
}
