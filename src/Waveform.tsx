// import { useRef } from 'react'
import styled from '@emotion/styled'
import { AudioFile } from './types'
import { useState } from 'react'

const WaveformCanvas = styled.canvas``
const CursorCanvas = styled.canvas``

// const audioCtx = new AudioContext()

function useAudioState() {
  const [startOffset, setStartOffset] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(false)
  const [viewStartSample, setViewStartSample] = useState(false)
}

export default function Waveform({ file }: { file: AudioFile }) {
  return (
    <div>
      <Canvases />
    </div>
  )
}

function Canvases() {
  return (
    <div>
      <WaveformCanvas />
      <CursorCanvas />
    </div>
  )
}
