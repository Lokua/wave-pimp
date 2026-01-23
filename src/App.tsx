import styled from '@emotion/styled'
import { useEffect, useState } from 'react'

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
  align-items: center;
  padding-left: 80px;
  flex-shrink: 0;
  height: 36px;
  text-align: center;
  user-select: none;
  background: var(--bg-main);
  z-index: 10;
`

const Content = styled.div`
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 24px;
  padding-top: 12px;
`

const DropArea = styled.div<{ isDragActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px;
  border: 1px dashed var(--text-color);
  text-align: center;
  background: ${({ isDragActive }) =>
    isDragActive ? 'rgba(0,0,0,0.05)' : 'transparent'};
  transition: background 0.15s;
`

export default function App() {
  const [view, setView] = useState('list')
  const [file, setFile] = useState<AudioFile | null>(null)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    sampleRate: 48000,
    bitDepth: 24,
  })
  const { isDragActive, eventHandlers } = useDropArea(async (files) => {
    setFiles(
      await Promise.all(
        files.map(async (file) => {
          const metadata = await parseBlob(file)
          console.log({ file, metadata })
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
          const audioBuffer = await audioCtx.decodeAudioData(buffer)
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
  })

  function onEditFile(file: AudioFile) {
    setView('edit')
    setFile(file)
  }

  function updateFile(next: AudioFile) {
    setFile(next)
    setFiles((prev) => prev.map((item) => (item.id === next.id ? next : item)))
  }

  function onClickBack() {
    setView('list')
  }

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(null)
      return
    }
    if (selectedFileId && !files.some((item) => item.id === selectedFileId)) {
      setSelectedFileId(null)
    }
  }, [files, selectedFileId])

  useEffect(() => {
    function openSettings() {
      setIsSettingsOpen(true)
    }

    window.electron.on('open-settings', openSettings)
    return () => {
      window.electron.off('open-settings', openSettings)
    }
  }, [])

  useEffect(() => {
    if (view !== 'list') return
    function onPointerDown(event: PointerEvent) {
      const path = event.composedPath()
      const clickedCard = path.some((item) => {
        if (!(item instanceof HTMLElement)) return false
        return item.dataset.waveCard === 'true'
      })
      if (clickedCard) return
      setSelectedFileId(null)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [view])

  return (
    <Container>
      <Titlebar />
      <Content>
        {files.length ? (
          <>
            {view === 'list' ? (
              <WaveGrid
                files={files}
                selectedId={selectedFileId}
                settings={settings}
                audioContext={audioCtx}
                onSelect={setSelectedFileId}
                onEdit={onEditFile}
                onUpdateFile={updateFile}
              />
            ) : (
              file && (
                <WaveEditor
                  file={file}
                  settings={settings}
                  audioContext={audioCtx}
                  onBack={onClickBack}
                  onUpdateFile={updateFile}
                />
              )
            )}
          </>
        ) : (
          <DropArea isDragActive={isDragActive} {...eventHandlers}>
            Drop audio file(s)
          </DropArea>
        )}
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
