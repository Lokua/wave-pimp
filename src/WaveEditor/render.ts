import type { SelectionRange, VisiblePeaks } from '../types'

const ENVELOPE_FILL_MIN_SAMPLES_PER_PIXEL = 4
const PEAK_LINE_MIN_SAMPLES_PER_PIXEL = 0.15

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
    ctx.strokeStyle = readCssVar('--separator-color')
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

  ctx.strokeStyle = readCssVar('--cursor-color')
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

  ctx.strokeStyle = readCssVar('--zero-line-color')
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

  ctx.fillStyle = readCssVar('--selection-color')
  ctx.fillRect(left, 0, right - left, cssHeight)
}

function drawChannelWaveform(
  ctx: CanvasRenderingContext2D,
  {
    channelIndex,
    mins,
    maxs,
    samplesPerPixel,
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

  const zeroLineY = channelTop + channelHeight / 2
  const amplitudeScale = channelHeight / 2

  if (samplesPerPixel >= ENVELOPE_FILL_MIN_SAMPLES_PER_PIXEL) {
    paintEnvelopeFill(ctx, {
      maxs,
      mins,
      zeroLineY,
      amplitudeScale,
    })
    return
  }

  if (samplesPerPixel > PEAK_LINE_MIN_SAMPLES_PER_PIXEL) {
    paintPeakLine(ctx, {
      maxs,
      mins,
      zeroLineY,
      amplitudeScale,
      cssWidth,
    })
    return
  }

  paintDotLine(ctx, {
    maxs,
    mins,
    zeroLineY,
    amplitudeScale,
    cssWidth,
    samplesPerPixel,
  })
}

function paintEnvelopeFill(
  ctx: CanvasRenderingContext2D,
  {
    maxs,
    mins,
    zeroLineY,
    amplitudeScale,
  }: {
    maxs: Float32Array
    mins: Float32Array
    zeroLineY: number
    amplitudeScale: number
  },
) {
  const MIN_THICKNESS_PX = 1
  const halfMinThickness = MIN_THICKNESS_PX / 2

  const len = Math.min(maxs.length, mins.length)

  ctx.beginPath()

  for (let i = 0; i < len; i++) {
    const x = i + 0.5

    const max = maxs[i] ?? 0
    const min = mins[i] ?? 0

    const yMax0 = zeroLineY - max * amplitudeScale
    const yMin0 = zeroLineY - min * amplitudeScale

    const mid = (yMax0 + yMin0) / 2
    const half = Math.max(Math.abs(yMax0 - yMin0) / 2, halfMinThickness)

    const yMax = mid - half

    if (i === 0) ctx.moveTo(x, yMax)
    else ctx.lineTo(x, yMax)
  }

  for (let i = len - 1; i >= 0; i--) {
    const x = i + 0.5

    const max = maxs[i] ?? 0
    const min = mins[i] ?? 0

    const yMax0 = zeroLineY - max * amplitudeScale
    const yMin0 = zeroLineY - min * amplitudeScale

    const mid = (yMax0 + yMin0) / 2
    const half = Math.max(Math.abs(yMax0 - yMin0) / 2, halfMinThickness)

    const yMin = mid + half

    ctx.lineTo(x, yMin)
  }

  ctx.closePath()
  ctx.fillStyle = readCssVar('--waveform-color')
  ctx.fill()
}

function paintPeakLine(
  ctx: CanvasRenderingContext2D,
  {
    maxs,
    mins,
    zeroLineY,
    amplitudeScale,
    cssWidth,
  }: {
    maxs: Float32Array
    mins: Float32Array
    zeroLineY: number
    amplitudeScale: number
    cssWidth: number
  },
) {
  ctx.beginPath()
  for (let i = 0; i < cssWidth; i++) {
    const min = mins[i] ?? 0
    const max = maxs[i] ?? 0
    const peak = Math.abs(max) >= Math.abs(min) ? max : min

    const x = i + 0.5
    const y = zeroLineY - peak * amplitudeScale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  ctx.strokeStyle = readCssVar('--waveform-color')
  ctx.lineWidth = 1
  ctx.stroke()
}

function paintDotLine(
  ctx: CanvasRenderingContext2D,
  {
    maxs,
    mins,
    zeroLineY,
    amplitudeScale,
    cssWidth,
    samplesPerPixel,
  }: {
    maxs: Float32Array
    mins: Float32Array
    zeroLineY: number
    amplitudeScale: number
    cssWidth: number
    samplesPerPixel: number
  },
) {
  const pixelsPerSample = 1 / samplesPerPixel
  const DOT_RADIUS = 2

  // Calculate how many samples are visible
  const numSamples = Math.ceil(cssWidth / pixelsPerSample)

  // Collect all sample points
  const points: Array<{ x: number; y: number }> = []

  for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
    const pixelPos = sampleIdx * pixelsPerSample
    const pixelIndex = Math.round(pixelPos)

    if (pixelIndex >= mins.length || pixelIndex >= maxs.length) break

    const min = mins[pixelIndex] ?? 0
    const max = maxs[pixelIndex] ?? 0
    const peak = Math.abs(max) >= Math.abs(min) ? max : min

    const x = pixelIndex + 0.5
    const y = zeroLineY - peak * amplitudeScale

    points.push({ x, y })
  }

  // Draw connecting lines
  if (points.length > 1) {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = readCssVar('--waveform-color-lighter')
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Draw dots at sample points
  ctx.fillStyle = readCssVar('--waveform-color')
  for (const point of points) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, DOT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }
}
function readCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}
