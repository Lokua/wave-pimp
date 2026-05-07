import type AudioPlayback from '../AudioPlayback'
import type { AudioFile, SelectionRange } from '../types'

type UseEditsArgs = {
  file: AudioFile
  audioContext: AudioContext
  audioBuffer: AudioBuffer
  nChannels: number
  sampleRate: number
  selectionRef: React.MutableRefObject<SelectionRange>
  isPlaying: boolean
  playbackRef: React.MutableRefObject<AudioPlayback>
  onUpdateFile: (next: AudioFile) => void
  resetSelection: () => void
  resetViewport: () => void
  recalculateVisiblePeaks: () => void
  bumpCanvasRevision: () => void
  setPreserveSelectionOnNextBuffer: (value: boolean) => void
}

export default function useEdits({
  file,
  audioContext,
  audioBuffer,
  nChannels,
  sampleRate,
  selectionRef,
  isPlaying,
  playbackRef,
  onUpdateFile,
  resetSelection,
  resetViewport,
  recalculateVisiblePeaks,
  bumpCanvasRevision,
  setPreserveSelectionOnNextBuffer,
}: UseEditsArgs) {
  function performAudioEdit(
    editFn: () => AudioBuffer | null,
    preserveSelection: boolean,
  ) {
    if (isPlaying) {
      playbackRef.current.stop()
    }

    const result = editFn()
    if (result instanceof AudioBuffer) {
      const nextFile = {
        ...file,
        audioBuffer: result,
        duration: result.duration,
        sampleCount: result.length,
      }
      playbackRef.current.setBuffer(result)
      onUpdateFile(nextFile)
      resetSelection()
      resetViewport()
      recalculateVisiblePeaks()
      return
    }

    setPreserveSelectionOnNextBuffer(preserveSelection)
    const sourceBuffer = audioBuffer
    const nextBuffer = audioContext.createBuffer(
      sourceBuffer.numberOfChannels,
      sourceBuffer.length,
      sourceBuffer.sampleRate,
    )
    for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
      nextBuffer.copyToChannel(sourceBuffer.getChannelData(ch), ch)
    }
    playbackRef.current.setBuffer(nextBuffer)
    onUpdateFile({
      ...file,
      audioBuffer: nextBuffer,
      duration: nextBuffer.duration,
      sampleCount: nextBuffer.length,
    })
    if (!preserveSelection) {
      resetSelection()
      resetViewport()
      recalculateVisiblePeaks()
    } else {
      bumpCanvasRevision()
    }
  }

  function crop() {
    performAudioEdit(() => {
      const { startSample, endSample } = selectionRef.current
      if (startSample == null || endSample == null) {
        alert('Please make a selection first')
        return null
      }

      const start = Math.min(startSample, endSample)
      const end = Math.max(startSample, endSample)
      const croppedLength = end - start

      const croppedBuffer = audioContext.createBuffer(
        nChannels,
        croppedLength,
        sampleRate,
      )

      for (let ch = 0; ch < nChannels; ch++) {
        const originalData = audioBuffer.getChannelData(ch)
        const croppedData = croppedBuffer.getChannelData(ch)
        for (let i = 0; i < croppedLength; i++) {
          croppedData[i] = originalData[start + i]
        }
      }

      return croppedBuffer
    }, false)
  }

  function trim() {
    performAudioEdit(() => {
      const { startSample, endSample } = selectionRef.current
      if (startSample == null || endSample == null) {
        alert('Please make a selection first')
        return null
      }

      const start = Math.min(startSample, endSample)
      const end = Math.max(startSample, endSample)
      const originalLength = audioBuffer.getChannelData(0).length
      const trimmedLength = originalLength - (end - start)

      const trimmedBuffer = audioContext.createBuffer(
        nChannels,
        trimmedLength,
        sampleRate,
      )

      for (let ch = 0; ch < nChannels; ch++) {
        const originalData = audioBuffer.getChannelData(ch)
        const trimmedData = trimmedBuffer.getChannelData(ch)

        for (let i = 0; i < start; i++) {
          trimmedData[i] = originalData[i]
        }

        for (let i = end; i < originalLength; i++) {
          trimmedData[i - (end - start)] = originalData[i]
        }
      }

      return trimmedBuffer
    }, false)
  }

  function fadeIn() {
    performAudioEdit(() => {
      const totalLength = audioBuffer.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < fadeLength; i++) {
          const gain = i / fadeLength
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function fadeOut() {
    performAudioEdit(() => {
      const totalLength = audioBuffer.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const fadeLength = end - start
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < fadeLength; i++) {
          const gain = 1 - i / fadeLength
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  function normalize() {
    performAudioEdit(() => {
      const totalLength = audioBuffer.getChannelData(0).length
      let start = 0
      let end = totalLength
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        start = Math.min(startSample, endSample)
        end = Math.max(startSample, endSample)
      }

      const selectionLength = end - start
      const target = 0.999
      let max = 0

      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          const sample = channelData[start + i]
          if (Math.abs(sample) > max) {
            max = Math.abs(sample)
          }
        }
      }

      const gain = max === 0 ? 1 : target / max
      for (let ch = 0; ch < nChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < selectionLength; i++) {
          channelData[start + i] *= gain
        }
      }

      return null
    }, true)
  }

  return {
    crop,
    trim,
    fadeIn,
    fadeOut,
    normalize,
  }
}
