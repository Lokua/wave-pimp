import { useState, useEffect, useCallback } from 'react'
import type { AudioFile, ThemePreferences } from './types'
import WaveCard from './WaveCard'
import DetailView from './DetailView'

const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
]

const DEFAULT_THEME: ThemePreferences = {
  waveformColor: 'var(--muted)',
  progressColor: 'var(--meter-color)',
  spectrogramColorMap: 'viridis',
}

export default function App() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [theme, setTheme] = useState<ThemePreferences>(DEFAULT_THEME)

  const handleRemove = useCallback(
    (id: string) => {
      setAudioFiles((prev) => {
        const file = prev.find((f) => f.id === id)
        if (file) {
          URL.revokeObjectURL(file.object_url)
        }
        return prev.filter((f) => f.id !== id)
      })
      if (selectedId === id) {
        setSelectedId(null)
      }
      if (detailId === id) {
        setDetailId(null)
      }
    },
    [selectedId, detailId],
  )

  const handleSaveFilename = useCallback(async (id: string) => {
    setAudioFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (!file || !file.edited_name) return prev

      window.electron
        .invoke('rename-file', {
          old_name: file.name,
          new_name: file.edited_name,
        })
        .then(() => {
          setAudioFiles((prev2) =>
            prev2.map((f) =>
              f.id === id
                ? { ...f, name: f.edited_name!, edited_name: undefined }
                : f,
            ),
          )
        })
        .catch((error) => {
          console.error('Failed to rename file:', error)
        })

      return prev
    })
  }, [])

  const handleUpdateFilename = useCallback((id: string, newName: string) => {
    setAudioFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, edited_name: newName } : f)),
    )
  }, [])

  const handleMetadataLoaded = useCallback(
    (
      id: string,
      metadata: {
        duration: number
        sample_rate: number
        channels: number
      },
    ) => {
      setAudioFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...metadata } : f)),
      )
    },
    [],
  )

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (modKey && e.key === ',') {
        e.preventDefault()
        setShowPrefs(true)
      }

      if (modKey && e.key === 's') {
        e.preventDefault()
        if (selectedId) {
          handleSaveFilename(selectedId)
        }
      }

      if (e.key === 'Delete' || (modKey && e.key === 'x')) {
        e.preventDefault()
        if (selectedId) {
          handleRemove(selectedId)
        }
      }

      if (e.key === 'Escape') {
        if (showPrefs) {
          setShowPrefs(false)
        } else if (detailId) {
          setDetailId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [selectedId, detailId, showPrefs, handleRemove, handleSaveFilename])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const audioFileList = files.filter((file) =>
      ACCEPTED_AUDIO_TYPES.includes(file.type),
    )

    const newAudioFiles: AudioFile[] = audioFileList.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      object_url: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
    }))

    setAudioFiles((prev) => [...prev, ...newAudioFiles])
  }

  const detailFile = audioFiles.find((f) => f.id === detailId)

  if (detailFile) {
    return (
      <div id="app">
        <div className="custom-titlebar" />
        <DetailView
          file={detailFile}
          theme={theme}
          onClose={() => setDetailId(null)}
        />
      </div>
    )
  }

  return (
    <div
      id="app"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="custom-titlebar" />
      {showPrefs && (
        <div className="prefs-overlay" onClick={() => setShowPrefs(false)}>
          <div className="prefs-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Preferences</h2>
            <div className="prefs-section">
              <label>Spectrogram Color Map</label>
              <select
                value={theme.spectrogramColorMap}
                onChange={(e) =>
                  setTheme({
                    ...theme,
                    spectrogramColorMap: e.target
                      .value as ThemePreferences['spectrogramColorMap'],
                  })
                }
              >
                <option value="viridis">Viridis (Purple/Yellow)</option>
                <option value="grayscale">Grayscale</option>
              </select>
            </div>
            <button onClick={() => setShowPrefs(false)}>Close</button>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-text">Drop audio files</div>
        </div>
      )}

      {audioFiles.length === 0 && !isDragging && (
        <div className="empty-state">
          <div className="empty-state-text">Drop audio files</div>
        </div>
      )}

      {audioFiles.length > 0 && (
        <main className="wave-card-grid">
          {audioFiles.map((file) => (
            <WaveCard
              key={file.id}
              file={file}
              theme={theme}
              isSelected={selectedId === file.id}
              onSelect={() => setSelectedId(file.id)}
              onDoubleClick={() => setDetailId(file.id)}
              onRemove={() => handleRemove(file.id)}
              onSave={() => handleSaveFilename(file.id)}
              onUpdateFilename={(name) => handleUpdateFilename(file.id, name)}
              onMetadataLoaded={(meta) => handleMetadataLoaded(file.id, meta)}
            />
          ))}
        </main>
      )}
    </div>
  )
}
