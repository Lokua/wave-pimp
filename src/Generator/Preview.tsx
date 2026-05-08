import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'

import useElementSize from '../useElementSize'
import { FRAME_LENGTH } from './constants'

const PreviewPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  gap: 12px;
`

const CanvasWrap = styled.div`
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-canvas);
  background: var(--bg-canvas);
`

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`

const InfoPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  flex-shrink: 0;
  gap: 8px 12px;
  padding: 0 4px;
`

const InfoItem = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;

  &:not(:last-child)::after {
    content: ' ';
    margin-left: 6px;
    opacity: 0.6;
  }
`

const InfoLabel = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
`

const InfoValue = styled.span`
  font-size: 12px;
`

function drawPreviewWaveform({
  canvas,
  samples,
  width,
  height,
}: {
  canvas: HTMLCanvasElement
  samples: Float32Array
  width: number
  height: number
}) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--zero-line-color')
    .trim()
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()

  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--waveform-color')
    .trim()
  ctx.beginPath()
  for (let x = 0; x < width; x++) {
    const index = Math.min(
      FRAME_LENGTH - 1,
      Math.floor((x / Math.max(1, width - 1)) * FRAME_LENGTH),
    )
    const y = height / 2 - samples[index] * (height * 0.48)
    if (x === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

type PreviewProps = {
  samples: Float32Array
  sampleRate: number
}

export default function Preview({ samples, sampleRate }: PreviewProps) {
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width, height } = useElementSize(canvasWrapRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawPreviewWaveform({ canvas, samples, width, height })
  }, [height, samples, width])

  return (
    <PreviewPane>
      <CanvasWrap ref={canvasWrapRef}>
        <Canvas ref={canvasRef} aria-label="Generated waveform preview" />
      </CanvasWrap>
      <InfoPanel>
        <InfoItem>
          <InfoLabel>Samples:</InfoLabel>
          <InfoValue>{FRAME_LENGTH.toLocaleString()}</InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Duration:</InfoLabel>
          <InfoValue>
            {((FRAME_LENGTH / sampleRate) * 1000).toFixed(2)} ms
          </InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Sample Rate:</InfoLabel>
          <InfoValue>{sampleRate.toLocaleString()} Hz</InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Channels:</InfoLabel>
          <InfoValue>1</InfoValue>
        </InfoItem>
      </InfoPanel>
    </PreviewPane>
  )
}
