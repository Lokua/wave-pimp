import { useMemo, useRef, useState } from 'react'
import styled from '@emotion/styled'

import type { AudioFile, Settings } from './types'
import WaveCard from './WaveCard'

const Grid = styled.div<{ layout: 'list' | 'grid' }>`
  display: ${({ layout }) => (layout === 'grid' ? 'grid' : 'flex')};
  flex-direction: column;
  grid-template-columns: ${({ layout }) =>
    layout === 'grid' ? 'repeat(auto-fill, minmax(360px, 1fr))' : 'none'};
  gap: 16px;
  width: 100%;
  outline: none;
`

type WaveGridProps = {
  files: AudioFile[]
  selectedId: string | null
  settings: Settings
  audioContext: AudioContext
  layout?: 'list' | 'grid'
  onSelect: (id: string) => void
  onEdit: (file: AudioFile) => void
  onRemove: (fileId: string) => void
  onUpdateFile: (next: AudioFile) => void
}

export default function WaveGrid({
  files,
  selectedId,
  settings,
  audioContext,
  layout = 'list',
  onSelect,
  onEdit,
  onRemove,
  onUpdateFile,
}: WaveGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const [renameSignal, setRenameSignal] = useState(0)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1
    return files.findIndex((item) => item.id === selectedId)
  }, [files, selectedId])

  function focusGrid() {
    gridRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (files.length === 0) return
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'r' &&
      event.key !== 'R' &&
      event.key !== 'Enter'
    ) {
      return
    }

    event.preventDefault()

    if (event.key === 'Enter') {
      if (!selectedId) return
      const target = files.find((item) => item.id === selectedId)
      if (target) {
        onEdit(target)
      }
      return
    }

    if (event.key === 'r' || event.key === 'R') {
      if (!selectedId) return
      setRenameTargetId(selectedId)
      setRenameSignal((prev) => prev + 1)
      return
    }

    const direction =
      event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const currentIndex = selectedIndex === -1 ? 0 : selectedIndex
    const nextIndex = Math.max(
      0,
      Math.min(files.length - 1, currentIndex + direction),
    )
    if (nextIndex === currentIndex) return
    const nextId = files[nextIndex].id
    onSelect(nextId)
    const node = cardRefs.current.get(nextId)
    if (node) {
      node.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  return (
    <Grid
      ref={gridRef}
      layout={layout}
      tabIndex={0}
      role="listbox"
      aria-activedescendant={
        selectedId ? `wave-card-${selectedId}` : undefined
      }
      onKeyDown={onKeyDown}
    >
      {files.map((file) => (
        <WaveCard
          key={file.id}
          id={`wave-card-${file.id}`}
          ref={(node) => {
            if (node) {
              cardRefs.current.set(file.id, node)
            } else {
              cardRefs.current.delete(file.id)
            }
          }}
          file={file}
          settings={settings}
          audioContext={audioContext}
          isSelected={file.id === selectedId}
          shouldRename={file.id === renameTargetId}
          renameSignal={renameSignal}
          onSelect={() => {
            onSelect(file.id)
            focusGrid()
          }}
          onEdit={onEdit}
          onRemove={onRemove}
          onUpdateFile={onUpdateFile}
        />
      ))}
    </Grid>
  )
}
