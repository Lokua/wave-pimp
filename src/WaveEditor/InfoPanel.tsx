import styled from '@emotion/styled'

import type { AudioFile } from '../types'
import { formatSize } from '../util'

const INFO_DELIMITER = ' '

const Panel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  /* justify-content: space-around; */
  gap: 8px 12px;
  padding: 0 16px 16px;
`

const Item = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;

  &:not(:last-child)::after {
    content: ' ${INFO_DELIMITER} ';
    margin-left: 6px;
    opacity: 0.6;
  }
`

const Label = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
`

const Value = styled.span`
  font-size: 12px;
`

type InfoPanelProps = {
  file: AudioFile
  samplesPerPixel: number
}

function formatDetailDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0 ms'
  if (seconds < 1) return `${(seconds * 1000).toFixed(2)} ms`
  return `${seconds.toFixed(3)} s`
}

export default function InfoPanel({ file, samplesPerPixel }: InfoPanelProps) {
  const sampleCount = file.sampleCount ?? file.audioBuffer.length

  return (
    <Panel>
      <Item>
        <Label>Name:</Label>
        <Value>{file.name}</Value>
      </Item>
      <Item>
        <Label>Size:</Label>
        <Value>{formatSize(file.size)}</Value>
      </Item>
      <Item>
        <Label>Duration:</Label>
        <Value>{formatDetailDuration(file.audioBuffer.duration)}</Value>
      </Item>
      <Item>
        <Label>Samples:</Label>
        <Value>{sampleCount.toLocaleString()}</Value>
      </Item>
      <Item>
        <Label>Sample Rate:</Label>
        <Value>{file.sampleRate.toLocaleString()} kHz</Value>
      </Item>
      <Item>
        <Label>Bit Depth:</Label>
        <Value>{file.bitDepth}</Value>
      </Item>
      <Item>
        <Label>Channels:</Label>
        <Value>{file.channels}</Value>
      </Item>
      <Item>
        <Label>Type:</Label>
        <Value>{file.type.replace('audio/', '')}</Value>
      </Item>
      <Item>
        <Label>Samples/Pixel:</Label>
        <Value>{samplesPerPixel.toFixed(2)}</Value>
      </Item>
    </Panel>
  )
}
