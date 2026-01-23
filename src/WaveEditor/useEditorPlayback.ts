import { useCallback } from 'react'

import useAudioPlayback from '../useAudioPlayback'
import type { SelectionRange } from '../types'

type UseEditorPlaybackArgs = {
  audioContext: AudioContext
  audioBuffer: AudioBuffer
  sampleRate: number
  selectionRef: React.RefObject<SelectionRange>
}

export default function useEditorPlayback({
  audioContext,
  audioBuffer,
  sampleRate,
  selectionRef,
}: UseEditorPlaybackArgs) {
  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer,
  })

  const onClickPlay = useCallback(() => {
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
  }, [playbackRef, playbackState.isPlaying, sampleRate, selectionRef])

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
