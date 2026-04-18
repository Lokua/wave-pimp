import { useRef, useState } from 'react'

export default function useDropArea(onDropFiles: (files: File[]) => void) {
  const [isDragActive, setIsDragActive] = useState(false)
  const dragDepthRef = useRef(0)

  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isFileDrag(e)) return
    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isFileDrag(e)) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isFileDrag(e)) return
    e.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
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
