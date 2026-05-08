import { useCallback, useEffect } from 'react'

import useAudioPlayback from '../useAudioPlayback'
import type { LoopRegion } from '../AudioPlayback'
import type { SelectionRange } from '../types'

type UseEditorPlaybackArgs = {
  audioContext: AudioContext
  audioBuffer: AudioBuffer
  sampleRate: number
  isLooping: boolean
  selectionRef: React.RefObject<SelectionRange>
}

export default function useEditorPlayback({
  audioContext,
  audioBuffer,
  sampleRate,
  isLooping,
  selectionRef,
}: UseEditorPlaybackArgs) {
  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer,
  })

  const computeLoopRegion = useCallback((): LoopRegion | null => {
    if (!isLooping) return null
    const { startSample, endSample } = selectionRef.current
    if (startSample != null && endSample != null) {
      const startSeconds = Math.min(startSample, endSample) / sampleRate
      const endSeconds = Math.max(startSample, endSample) / sampleRate
      if (endSeconds > startSeconds) {
        return { startSeconds, endSeconds }
      }
    }
    return { startSeconds: 0, endSeconds: audioBuffer.duration }
  }, [audioBuffer, isLooping, sampleRate, selectionRef])

  useEffect(() => {
    playbackRef.current.setLoopRegion(computeLoopRegion())
  }, [computeLoopRegion, playbackRef])

  const onClickPlay = useCallback(() => {
    playbackRef.current.setLoopRegion(computeLoopRegion())

    if (playbackState.isPlaying) {
      playbackRef.current.stop()
      const { startSample, endSample } = selectionRef.current
      if (startSample != null && endSample != null) {
        const start = Math.min(startSample, endSample)
        playbackRef.current.play({ fromSeconds: start / sampleRate })
      } else {
        playbackRef.current.play({ fromSeconds: 0 })
      }
      return
    }

    playbackRef.current.play()
  }, [
    computeLoopRegion,
    playbackRef,
    playbackState.isPlaying,
    sampleRate,
    selectionRef,
  ])

  const onClickStop = useCallback(() => {
    if (playbackState.isPlaying) {
      playbackRef.current.pause()
    } else {
      playbackRef.current.stop()
    }
  }, [playbackRef, playbackState.isPlaying])

  const getCursorSample = useCallback(() => {
    return playbackRef.current.getCurrentSample(sampleRate)
  }, [playbackRef, sampleRate])

  const seekToSample = useCallback(
    (sample: number) => {
      playbackRef.current.seek(sample / sampleRate)
    },
    [playbackRef, sampleRate],
  )

  return {
    playbackRef,
    isPlaying: playbackState.isPlaying,
    onClickPlay,
    onClickStop,
    getCursorSample,
    seekToSample,
  }
}
