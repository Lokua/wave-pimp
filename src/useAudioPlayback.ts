import { useEffect, useRef, useState } from 'react'
import AudioPlayback from './AudioPlayback'
import type { PlaybackStateSnapshot } from './AudioPlayback'

type UseAudioPlaybackOptions = {
  audioContext: AudioContext
  closeOnUnmount?: boolean
}

export default function useAudioPlayback({
  audioContext,
  closeOnUnmount = true,
}: UseAudioPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [startOffsetSeconds, setStartOffsetSeconds] = useState(0)
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)

  const playbackRef = useRef(
    new AudioPlayback({
      audioContext,
      onStateChange(snapshot: PlaybackStateSnapshot) {
        setIsPlaying(snapshot.isPlaying)
        setStartOffsetSeconds(snapshot.startOffsetSeconds)
        setCurrentTimeSeconds(snapshot.currentTimeSeconds)
        setDurationSeconds(snapshot.durationSeconds)
      },
    }),
  )

  useEffect(() => {
    return () => {
      if (closeOnUnmount) {
        playbackRef.current.destroy()
      } else {
        playbackRef.current.stop()
      }
    }
  }, [closeOnUnmount])

  return {
    playback: playbackRef,
    isPlaying,
    startOffsetSeconds,
    currentTimeSeconds,
    durationSeconds,
  }
}
