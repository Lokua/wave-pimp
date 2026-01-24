import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'

import type { SelectionRange, VisiblePeaks } from '../types'
import { drawCursor, drawWaveformBase } from './render'
import useElementSize from '../useElementSize'

const CanvasWrap = styled.div<{ height?: number }>`
  position: relative;
  width: 100%;
  height: ${({ height }) => (height ? `${height}px` : '100%')};
`

const BaseCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  background: var(--bg-canvas);
  border: 1px solid var(--border-canvas);
`

const CursorCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
`

type CtxRef = { current: CanvasRenderingContext2D | null }

type WaveformCanvasProps = {
  nChannels: number
  visiblePeaks: VisiblePeaks
  viewStartSample: number
  samplesPerPixel: number
  selection?: SelectionRange
  canvasRevision: number
  getCursorSample?: () => number | null
  height?: number
  onResize?: (size: { width: number; height: number }) => void
  onClick?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseDown?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseMove?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseLeave?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onWheel?: (event: React.WheelEvent<HTMLCanvasElement>) => void
}

export default function WaveformCanvas({
  nChannels,
  visiblePeaks,
  viewStartSample,
  samplesPerPixel,
  selection,
  canvasRevision,
  getCursorSample,
  height: heightProp,
  onResize,
  onClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onWheel,
}: WaveformCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const baseCtxRef: CtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const cursorCtxRef: CtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const { width, height: measuredHeight } = useElementSize(wrapRef)
  const height = heightProp ?? measuredHeight

  useEffect(() => {
    if (!onResize) return
    if (width <= 0 || height <= 0) return
    onResize({ width, height })
  }, [height, onResize, width])

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current
    const cursorCanvas = cursorCanvasRef.current
    if (!baseCanvas || !cursorCanvas) return

    const dpr = window.devicePixelRatio || 1
    const canvasWidth = Math.max(1, Math.floor(width))
    const canvasHeight = Math.max(1, Math.floor(height))

    function setupCanvas(canvas: HTMLCanvasElement, ctxRef: CtxRef) {
      canvas.width = Math.floor(canvasWidth * dpr)
      canvas.height = Math.floor(canvasHeight * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctxRef.current = ctx
    }

    setupCanvas(baseCanvas, baseCtxRef)
    setupCanvas(cursorCanvas, cursorCtxRef)
  }, [width, height])

  useEffect(() => {
    console.time('[PERF] Canvas render')
    const ctx = baseCtxRef.current
    if (!ctx) {
      console.timeEnd('[PERF] Canvas render')
      return
    }
    if (width <= 0 || height <= 0) {
      console.timeEnd('[PERF] Canvas render')
      return
    }
    if (visiblePeaks.visibleMinPerChannel.length < nChannels) {
      console.timeEnd('[PERF] Canvas render')
      return
    }
    if (visiblePeaks.visibleMaxPerChannel.length < nChannels) {
      console.timeEnd('[PERF] Canvas render')
      return
    }

    console.time('[PERF] drawWaveformBase')
    drawWaveformBase(ctx, {
      cssWidth: width,
      cssHeight: height,
      nChannels,
      samplesPerPixel,
      viewStartSample,
      visiblePeaks,
      selection,
    })
    console.timeEnd('[PERF] drawWaveformBase')
    console.timeEnd('[PERF] Canvas render')
  }, [
    canvasRevision,
    height,
    nChannels,
    samplesPerPixel,
    selection,
    viewStartSample,
    visiblePeaks,
    width,
  ])

  useEffect(() => {
    let frame = 0

    function draw() {
      const ctx = cursorCtxRef.current
      if (ctx) {
        const cursorSample = getCursorSample ? getCursorSample() : null
        drawCursor(ctx, {
          cssWidth: width,
          cssHeight: height,
          viewStartSample,
          samplesPerPixel,
          cursorSample,
        })
      }
      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [height, getCursorSample, width, samplesPerPixel, viewStartSample])

  return (
    <CanvasWrap ref={wrapRef} height={heightProp}>
      <BaseCanvas
        ref={baseCanvasRef}
        onClick={onClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      />
      <CursorCanvas ref={cursorCanvasRef} />
    </CanvasWrap>
  )
}
