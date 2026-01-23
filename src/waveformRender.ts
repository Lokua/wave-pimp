import type { SelectionRange, VisiblePeaks } from './types'

type DrawWaveformOptions = {
  cssWidth: number
  cssHeight: number
  nChannels: number
  samplesPerPixel: number
  viewStartSample: number
  visiblePeaks: VisiblePeaks
  selection?: SelectionRange
}

type DrawCursorOptions = {
  cssWidth: number
  cssHeight: number
  viewStartSample: number
  samplesPerPixel: number
  cursorSample: number | null
}

export function drawWaveformBase(
  ctx: CanvasRenderingContext2D,
  {
    cssWidth,
    cssHeight,
    nChannels,
    samplesPerPixel,
    viewStartSample,
    visiblePeaks,
    selection,
  }: DrawWaveformOptions,
) {
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  drawSelectionBackground(ctx, {
    cssWidth,
    cssHeight,
    viewStartSample,
    samplesPerPixel,
    selection,
  })

  const gutterHeight = 0

  if (nChannels === 2) {
    const gutterY = cssHeight / 2
    ctx.strokeStyle = readCssVar('--separator-color', '#666')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, gutterY)
    ctx.lineTo(cssWidth, gutterY)
    ctx.stroke()
  }

  for (let ch = 0; ch < nChannels; ch++) {
    drawZeroLine(ctx, {
      channelIndex: ch,
      cssHeight,
      cssWidth,
      gutterHeight,
      nChannels,
    })
  }

  for (let ch = 0; ch < nChannels; ch++) {
    drawChannelWaveform(ctx, {
      channelIndex: ch,
      mins: visiblePeaks.visibleMinPerChannel[ch],
      maxs: visiblePeaks.visibleMaxPerChannel[ch],
      samplesPerPixel,
      viewStartSample,
      cssHeight,
      cssWidth,
      gutterHeight,
      nChannels,
    })
  }
}

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  {
    cssWidth,
    cssHeight,
    viewStartSample,
    samplesPerPixel,
    cursorSample,
  }: DrawCursorOptions,
) {
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  if (cursorSample == null) return

  const x = (cursorSample - viewStartSample) / samplesPerPixel
  if (x < 0 || x > cssWidth) return

  ctx.strokeStyle = readCssVar('--cursor-color', '#ff6666')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, cssHeight)
  ctx.stroke()
}

function drawZeroLine(
  ctx: CanvasRenderingContext2D,
  {
    channelIndex,
    cssHeight,
    cssWidth,
    gutterHeight,
    nChannels,
  }: {
    channelIndex: number
    cssHeight: number
    cssWidth: number
    gutterHeight: number
    nChannels: number
  },
) {
  const availableHeight = cssHeight - gutterHeight
  const channelHeight = availableHeight / nChannels

  let channelTop
  if (nChannels === 2) {
    channelTop = channelIndex === 0 ? 0 : channelHeight + gutterHeight
  } else {
    channelTop = channelIndex * channelHeight
  }

  const centerY = channelTop + channelHeight / 2

  ctx.strokeStyle = readCssVar('--zero-line-color', '#666')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.stroke()
}

function drawSelectionBackground(
  ctx: CanvasRenderingContext2D,
  {
    cssWidth,
    cssHeight,
    viewStartSample,
    samplesPerPixel,
    selection,
  }: {
    cssWidth: number
    cssHeight: number
    viewStartSample: number
    samplesPerPixel: number
    selection?: SelectionRange
  },
) {
  if (!selection) return
  const { startSample, endSample } = selection
  if (startSample == null || endSample == null) return

  const startX = (startSample - viewStartSample) / samplesPerPixel
  const endX = (endSample - viewStartSample) / samplesPerPixel

  const left = Math.max(0, Math.min(startX, endX))
  const right = Math.min(cssWidth, Math.max(startX, endX))

  if (right <= 0 || left >= cssWidth) {
    return
  }

  ctx.fillStyle = readCssVar('--selection-color', 'rgba(100, 149, 237, 0.15)')
  ctx.fillRect(left, 0, right - left, cssHeight)
}

function drawChannelWaveform(
  ctx: CanvasRenderingContext2D,
  {
    channelIndex,
    mins,
    maxs,
    samplesPerPixel,
    viewStartSample,
    cssHeight,
    cssWidth,
    gutterHeight,
    nChannels,
  }: {
    channelIndex: number
    mins: Float32Array
    maxs: Float32Array
    samplesPerPixel: number
    viewStartSample: number
    cssHeight: number
    cssWidth: number
    gutterHeight: number
    nChannels: number
  },
) {
  const availableHeight = cssHeight - gutterHeight
  const channelHeight = availableHeight / nChannels

  let channelTop
  if (nChannels === 2) {
    channelTop = channelIndex === 0 ? 0 : channelHeight + gutterHeight
  } else {
    channelTop = channelIndex * channelHeight
  }

  const centerY = channelTop + channelHeight / 2
  const amplitudeScale = channelHeight / 2

  if (samplesPerPixel >= 4) {
    ctx.beginPath()

    for (let i = 0; i < maxs.length; i++) {
      const x = i + 0.5
      const y = centerY - maxs[i] * amplitudeScale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    for (let i = mins.length - 1; i >= 0; i--) {
      const x = i + 0.5
      const y = centerY - mins[i] * amplitudeScale
      ctx.lineTo(x, y)
    }

    ctx.closePath()
    ctx.fillStyle = readCssVar('--waveform-color', '#d0d0d0')
    ctx.fill()
    return
  }

  if (samplesPerPixel > 1) {
    ctx.beginPath()
    for (let i = 0; i < cssWidth; i++) {
      const min = mins[i] ?? 0
      const max = maxs[i] ?? 0
      const peak = Math.abs(max) >= Math.abs(min) ? max : min

      const x = i + 0.5
      const y = centerY - peak * amplitudeScale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.strokeStyle = readCssVar('--waveform-color', '#d0d0d0')
    ctx.lineWidth = 1
    ctx.stroke()
    return
  }

  ctx.beginPath()

  for (let i = 0; i < cssWidth; i++) {
    const min = mins[i] ?? 0
    const max = maxs[i] ?? 0
    const s = Math.abs(max) >= Math.abs(min) ? max : min
    const x = i + 0.5
    const y = centerY - s * amplitudeScale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  ctx.strokeStyle = readCssVar('--waveform-color', '#d0d0d0')
  ctx.lineWidth = 1
  ctx.stroke()
}

function readCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return value.trim() || fallback
}
