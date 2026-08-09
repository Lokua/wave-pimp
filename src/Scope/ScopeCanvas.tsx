import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'

import useElementSize from '../useElementSize'

const CanvasWrap = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--border-canvas);
  background: var(--bg-canvas);
`

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`

type ScopeCanvasProps = {
  analyser: AnalyserNode | null
  sampleRate: number | null
  statusMessage: string
}

function cssColor(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  context.lineWidth = 1
  context.strokeStyle = cssColor('--scope-grid-color')
  context.beginPath()

  for (let division = 1; division < 10; division++) {
    const x = (division / 10) * width
    context.moveTo(x, 0)
    context.lineTo(x, height)
  }

  for (let division = 1; division < 8; division++) {
    const y = (division / 8) * height
    context.moveTo(0, y)
    context.lineTo(width, y)
  }

  context.stroke()

  context.strokeStyle = cssColor('--zero-line-color')
  context.beginPath()
  context.moveTo(0, height / 2)
  context.lineTo(width, height / 2)
  context.stroke()
}

function drawTrace(
  context: CanvasRenderingContext2D,
  samples: Float32Array<ArrayBuffer>,
  width: number,
  height: number,
) {
  const centerY = height / 2
  const amplitude = height * 0.46
  const samplesPerPixel = samples.length / width

  context.lineWidth = 1.25
  context.strokeStyle = cssColor('--scope-trace-color')
  context.beginPath()

  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * samplesPerPixel)
    const end = Math.max(start + 1, Math.floor((x + 1) * samplesPerPixel))
    let minimum = 1
    let maximum = -1

    for (let index = start; index < end && index < samples.length; index++) {
      const sample = samples[index]
      minimum = Math.min(minimum, sample)
      maximum = Math.max(maximum, sample)
    }

    context.moveTo(x + 0.5, centerY - maximum * amplitude)
    context.lineTo(x + 0.5, centerY - minimum * amplitude)
  }

  context.stroke()
}

function drawLabels({
  context,
  samples,
  sampleRate,
  width,
  height,
}: {
  context: CanvasRenderingContext2D
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
  width: number
  height: number
}) {
  let sum = 0
  let peak = 0
  for (const sample of samples) {
    sum += sample
    peak = Math.max(peak, Math.abs(sample))
  }

  const mean = sum / samples.length
  const windowMs = (samples.length / sampleRate) * 1000
  context.fillStyle = cssColor('--scope-label-color')
  context.font = '10px "Fira Code", monospace'
  context.textBaseline = 'top'
  context.fillText('+1.0', 8, 8)
  context.fillText(' 0.0', 8, height / 2 + 6)
  context.textBaseline = 'bottom'
  context.fillText('-1.0', 8, height - 8)

  const summary = [
    `${windowMs.toFixed(1)} ms`,
    `mean ${mean >= 0 ? '+' : ''}${mean.toFixed(4)}`,
    `peak ${peak.toFixed(4)}`,
  ].join('   ')
  const metrics = context.measureText(summary)
  context.fillText(summary, Math.max(8, width - metrics.width - 8), height - 8)
}

export default function ScopeCanvas({
  analyser,
  sampleRate,
  statusMessage,
}: ScopeCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width, height } = useElementSize(wrapRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) return
    const context: CanvasRenderingContext2D = canvasContext
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    const samples = analyser
      ? new Float32Array(analyser.fftSize)
      : null
    let animationFrame = 0

    function draw() {
      context.clearRect(0, 0, width, height)
      drawGrid(context, width, height)

      if (analyser && samples && sampleRate) {
        analyser.getFloatTimeDomainData(samples)
        drawTrace(context, samples, width, height)
        drawLabels({
          context,
          samples,
          sampleRate,
          width,
          height,
        })
      } else {
        context.fillStyle = cssColor('--scope-label-color')
        context.font = '12px "Fira Code", monospace'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(statusMessage, width / 2, height / 2)
        context.textAlign = 'start'
      }

      if (analyser) animationFrame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationFrame)
  }, [analyser, height, sampleRate, statusMessage, width])

  return (
    <CanvasWrap ref={wrapRef}>
      <Canvas ref={canvasRef} aria-label="Live input waveform" />
    </CanvasWrap>
  )
}
