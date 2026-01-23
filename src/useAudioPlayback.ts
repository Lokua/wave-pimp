import { useEffect, useRef, useState } from 'react'
import AudioPlayback from './AudioPlayback'
import type { PlaybackStateSnapshot } from './AudioPlayback'

type UseAudioPlaybackOptions = {
  audioContext: AudioContext
  audioBuffer: AudioBuffer
}

export default function useAudioPlayback({
  audioContext,
  audioBuffer,
}: UseAudioPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [startOffsetSeconds, setStartOffsetSeconds] = useState(0)
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)

  const playbackRef = useRef(
    new AudioPlayback({
      audioContext,
      audioBuffer,
      onStateChange(snapshot: PlaybackStateSnapshot) {
        setIsPlaying(snapshot.isPlaying)
        setStartOffsetSeconds(snapshot.startOffsetSeconds)
        setCurrentTimeSeconds(snapshot.currentTimeSeconds)
        setDurationSeconds(snapshot.durationSeconds)
      },
    }),
  )

  useEffect(() => {
    const playback = playbackRef.current
    return () => {
      playback.stop()
    }
  }, [])

  return {
    playback: playbackRef,
    isPlaying,
    startOffsetSeconds,
    currentTimeSeconds,
    durationSeconds,
  }
}
