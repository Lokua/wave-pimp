import styled from '@emotion/styled'

import type { AudioFile, Settings } from './types'
import IconButton from './components/IconButton'
import WaveGrid from './WaveGrid'

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
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
`

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
`

type BulkViewProps = {
  files: AudioFile[]
  settings: Settings
  audioContext: AudioContext
  onExit: () => void
  onUpdateFile: (next: AudioFile) => void
  onRemoveFile: (fileId: string) => void
}

export default function BulkView({
  files,
  settings,
  audioContext,
  onExit,
  onUpdateFile,
  onRemoveFile,
}: BulkViewProps) {
  return (
    <Container>
      <Toolbar>
        <IconButton name="Back" aria-label="Exit bulk mode" onClick={onExit} />
        <ToolbarLabel>BULK MODE</ToolbarLabel>
      </Toolbar>
      <Body>
        <WaveGrid
          files={files}
          selectedId={null}
          settings={settings}
          audioContext={audioContext}
          layout="grid"
          onSelect={() => {}}
          onEdit={() => {}}
          onRemove={onRemoveFile}
          onUpdateFile={onUpdateFile}
        />
      </Body>
    </Container>
  )
}
