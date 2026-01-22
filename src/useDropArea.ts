import { useState } from 'react'

export default function useDropArea(onDropFiles: (files: File[]) => void) {
  const [isDragActive, setIsDragActive] = useState(false)

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    const wavFiles = files.filter(
      (file) => file.type === 'audio/wav' || file.name.endsWith('.wav'),
    )
    onDropFiles(wavFiles)
  }

  return {
    isDragActive,
    eventHandlers: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
  }
}
