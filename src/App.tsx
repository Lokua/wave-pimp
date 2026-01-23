import styled from '@emotion/styled'
import { useState } from 'react'
import { parseBlob } from 'music-metadata'

import { AudioFile } from './types'
import useDropArea from './useDropArea'
import WaveCard from './WaveCard'
import WaveEditor from './WaveEditor'

const audioCtx = new AudioContext()

const Container = styled.div`
  display: flex;
  flex-direction: column;
  overflow: auto;
  height: 100vh;
  padding: 24px;
  padding-top: 0;
`

const Titlebar = styled.div`
  -webkit-app-region: drag;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  padding-left: 80px;
  flex-shrink: 0;
  height: 36px;
  text-align: center;
  user-select: none;
`

const DropArea = styled.div<{ isDragActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 24px;
  border: 1px dashed var(--text-color);
  text-align: center;
  background: ${({ isDragActive }) =>
    isDragActive ? 'rgba(0,0,0,0.05)' : 'transparent'};
  transition: background 0.15s;
`

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  justify-content: center;
  gap: 16px;
`

export default function App() {
  const [view, setView] = useState('list')
  const [file, setFile] = useState<AudioFile | null>(null)
  const [files, setFiles] = useState<AudioFile[]>([])
  const { isDragActive, eventHandlers } = useDropArea(async (files) => {
    setFiles(
      await Promise.all(
        files.map(async (file) => {
          const metadata = await parseBlob(file)
          console.log({ file, metadata })
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

  return (
    <Container>
      <Titlebar />
      {files.length > 0 ? (
        <>
          {view === 'list' ? (
            <Cards>
              {files.map((file) => (
                <WaveCard
                  key={file.id}
                  file={file}
                  audioContext={audioCtx}
                  onEdit={onEditFile}
                />
              ))}
            </Cards>
          ) : (
            file && (
              <WaveEditor
                file={file}
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
    </Container>
  )
}
