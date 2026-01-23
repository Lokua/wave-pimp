import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'
import type { SelectionRange, VisiblePeaks } from './types'
import { drawCursor, drawWaveformBase } from './waveformRender'
import useElementSize from './useElementSize'

type CtxRef = { current: CanvasRenderingContext2D | null }

type WaveformCanvasProps = {
  nChannels: number
  visiblePeaks: VisiblePeaks
  viewStartSample: number
  samplesPerPixel: number
  selection?: SelectionRange
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

export default function WaveformCanvas({
  nChannels,
  visiblePeaks,
  viewStartSample,
  samplesPerPixel,
  selection,
  getCursorSample,
  height,
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
  const cssHeight = height ?? measuredHeight

  useEffect(() => {
    if (!onResize) return
    if (width <= 0 || cssHeight <= 0) return
    onResize({ width, height: cssHeight })
  }, [cssHeight, onResize, width])

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current
    const cursorCanvas = cursorCanvasRef.current
    if (!baseCanvas || !cursorCanvas) return

    const dpr = window.devicePixelRatio || 1
    const canvasWidth = Math.max(1, Math.floor(width))
    const canvasHeight = Math.max(1, Math.floor(cssHeight))

    const setup = (canvas: HTMLCanvasElement, ctxRef: CtxRef) => {
      canvas.width = Math.floor(canvasWidth * dpr)
      canvas.height = Math.floor(canvasHeight * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctxRef.current = ctx
    }

    setup(baseCanvas, baseCtxRef)
    setup(cursorCanvas, cursorCtxRef)
  }, [width, cssHeight])

  useEffect(() => {
    const ctx = baseCtxRef.current
    if (!ctx) return
    if (width <= 0 || cssHeight <= 0) return
    if (visiblePeaks.visibleMinPerChannel.length < nChannels) return
    if (visiblePeaks.visibleMaxPerChannel.length < nChannels) return

    drawWaveformBase(ctx, {
      cssWidth: width,
      cssHeight,
      nChannels,
      samplesPerPixel,
      viewStartSample,
      visiblePeaks,
      selection,
    })
  }, [
    cssHeight,
    nChannels,
    samplesPerPixel,
    selection,
    viewStartSample,
    visiblePeaks,
    width,
  ])

  useEffect(() => {
    let frame: number
    const draw = () => {
      const ctx = cursorCtxRef.current
      if (ctx) {
        const cursorSample = getCursorSample ? getCursorSample() : null
        drawCursor(ctx, {
          cssWidth: width,
          cssHeight,
          viewStartSample,
          samplesPerPixel,
          cursorSample,
        })
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [cssHeight, getCursorSample, samplesPerPixel, viewStartSample, width])

  return (
    <CanvasWrap ref={wrapRef} height={height}>
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
