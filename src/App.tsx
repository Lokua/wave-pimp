import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'

import { AudioFile, Settings } from './types'
import useDropArea from './useDropArea'
import WaveEditor from './WaveEditor'
import { parseBlob } from 'music-metadata'
import SettingsModal from './SettingsModal'
import WaveGrid from './WaveGrid'

const audioCtx = new AudioContext()

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

const TitlebarFileName = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Content = styled.div<{ isSidebarVisible: boolean }>`
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 6px 12px 0px;
  gap: ${({ isSidebarVisible }) => (isSidebarVisible ? '12px' : '0')};
`

const Sidebar = styled.aside<{ isVisible: boolean; isDragActive: boolean }>`
  display: flex;
  flex-direction: column;
  flex: 0 0 ${({ isVisible }) => (isVisible ? '420px' : '0px')};
  min-width: 0;
  overflow: hidden;
  border: ${({ isVisible, isDragActive }) =>
    isVisible && isDragActive
      ? '1px dashed var(--text-color)'
      : '0 solid transparent'};
  background: ${({ isDragActive }) =>
    isDragActive ? 'rgba(0,0,0,0.05)' : 'transparent'};
  opacity: ${({ isVisible }) => (isVisible ? 1 : 0)};
  pointer-events: ${({ isVisible }) => (isVisible ? 'auto' : 'none')};
`

const SidebarInner = styled.div`
  width: 420px;
  max-width: 100%;
  height: 100%;
  overflow: auto;
  padding: 12px;
`

const SidebarEmpty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
  text-align: center;
`

const EditorPane = styled.section`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

const EditorEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
`

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

export default function App() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [sidebarSelectedFileId, setSidebarSelectedFileId] = useState<
    string | null
  >(null)
  const [editorFileId, setEditorFileId] = useState<string | null>(null)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    sampleRate: 48000,
    bitDepth: 24,
  })
  const { isDragActive, eventHandlers } = useDropArea(async (files) => {
    if (files.length === 0) {
      return
    }

    console.time('[PERF] Total file drop')
    console.log(`[PERF] Starting file drop for ${files.length} file(s)`)

    setIsLoadingFiles(true)
    try {
      setFiles(
        await Promise.all(
          files.map(async (file) => {
            const fileLabel = `[PERF] "${file.name}"`
            console.log(
              `${fileLabel} - ${(file.size / 1024 / 1024).toFixed(2)} MB`,
            )

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

            console.time(`${fileLabel} - Audio decoding`)
            const audioBuffer = await audioCtx.decodeAudioData(buffer)
            console.timeEnd(`${fileLabel} - Audio decoding`)

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
              buffer,
              audioBuffer,
            }
          }),
        ),
      )
    } finally {
      setIsLoadingFiles(false)
      console.timeEnd('[PERF] Total file drop')
    }
  })

  function onEditFile(file: AudioFile) {
    setEditorFileId(file.id)
    setSidebarSelectedFileId(file.id)
  }

  function updateFile(next: AudioFile) {
    setFiles((prev) => prev.map((item) => (item.id === next.id ? next : item)))
  }

  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((item) => item.id !== fileId))
  }

  useEffect(() => {
    if (files.length === 0) {
      setSidebarSelectedFileId(null)
      setEditorFileId(null)
      setIsSidebarVisible(true)
      return
    }

    const firstFileId = files[0].id
    const hasEditorFile =
      editorFileId != null && files.some((item) => item.id === editorFileId)
    const nextEditorFileId = hasEditorFile ? editorFileId : firstFileId

    if (!hasEditorFile) {
      setEditorFileId(firstFileId)
    }

    const hasSidebarSelection =
      sidebarSelectedFileId != null &&
      files.some((item) => item.id === sidebarSelectedFileId)
    if (!hasSidebarSelection) {
      setSidebarSelectedFileId(nextEditorFileId)
    }
  }, [editorFileId, files, sidebarSelectedFileId])

  const selectedFile = useMemo(() => {
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

  return (
    <Container>
      <Titlebar>
        <TitlebarFileName>{selectedFile?.name ?? ''}</TitlebarFileName>
      </Titlebar>
      <Content isSidebarVisible={isSidebarVisible}>
        <Sidebar
          isVisible={isSidebarVisible}
          isDragActive={isDragActive}
          aria-hidden={!isSidebarVisible}
          {...eventHandlers}
        >
          <SidebarInner>
            {files.length ? (
              <WaveGrid
                files={files}
                selectedId={sidebarSelectedFileId}
                settings={settings}
                audioContext={audioCtx}
                onSelect={setSidebarSelectedFileId}
                onEdit={onEditFile}
                onRemove={removeFile}
                onUpdateFile={updateFile}
              />
            ) : (
              <SidebarEmpty>Drop audio file(s)</SidebarEmpty>
            )}
          </SidebarInner>
        </Sidebar>
        <EditorPane>
          {selectedFile ? (
            <WaveEditor
              file={selectedFile}
              settings={settings}
              audioContext={audioCtx}
              isSidebarVisible={isSidebarVisible}
              onToggleSidebar={() => {
                setIsSidebarVisible((prev) => !prev)
              }}
              onUpdateFile={updateFile}
            />
          ) : (
            <EditorEmpty>
              Drop audio file(s) in the sidebar to begin.
            </EditorEmpty>
          )}
        </EditorPane>
        {isLoadingFiles ? (
          <LoadingOverlay>
            <LoadingSpinner />
            <div>Loading audio file(s)...</div>
          </LoadingOverlay>
        ) : null}
      </Content>
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
