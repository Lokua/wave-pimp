import React from 'react'
import { AudioFile } from './types'
import { formatDuration, formatSize } from './util'
import Waveform from './Waveform'

interface WaveCardProps extends React.HTMLAttributes<HTMLUListElement> {
  file: AudioFile
}

export default function WaveCard({ file, ...rest }: WaveCardProps) {
  return (
    <>
      <ul {...rest}>
        <li>name: {file.name}</li>
        <li>size: {formatSize(file.size)}</li>
        <li>type: {file.type.replace('audio/', '')}</li>
        <li>duration: {formatDuration(file.duration)}</li>
        <li>sampleRate: {file.sampleRate.toLocaleString()} kHz</li>
        <li>bitDepth: {file.bitDepth}</li>
        <li>channels: {file.channels}</li>
      </ul>
      <Waveform file={file} />
    </>
  )
}
