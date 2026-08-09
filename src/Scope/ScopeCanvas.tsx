import styled from '@emotion/styled'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

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

export type ScopeSampleBuffer = {
  data: Float32Array<ArrayBuffer>
  length: number
  totalSamples: number
  writeIndex: number
}

type ScopeCanvasProps = {
  isLive: boolean
  sampleBuffers: RefObject<ScopeSampleBuffer[]>
  sampleRate: number | null
  statusMessage: string
  timeDivisionMs: number
  trigger: {
    level: number
    mode: 'auto' | 'normal' | 'off'
    slope: 'rising' | 'falling'
    source: number
    viewMode: 'time' | 'cycle'
  }
  traces: Array<{ enabled: boolean; color: string }>
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
  color: string,
) {
  const centerY = height / 2
  const amplitude = height * 0.46
  const pointCount = Math.max(
    2,
    Math.min(samples.length, Math.ceil(width * 2)),
  )

  context.lineWidth = 1.25
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = cssColor(color)

  context.beginPath()
  for (let point = 0; point < pointCount; point++) {
    const progress = point / (pointCount - 1)
    const sample = interpolatedSample(
      samples,
      progress * (samples.length - 1),
    )
    const x = progress * width
    const y = centerY - sample * amplitude
    if (point === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.stroke()
}

function drawLabels({
  context,
  samples,
  windowMs,
  frequencyHz,
  width,
  height,
}: {
  context: CanvasRenderingContext2D
  samples: Float32Array<ArrayBuffer>
  windowMs: number
  frequencyHz: number | null
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
  context.fillStyle = cssColor('--scope-label-color')
  context.font = '10px "Fira Code", monospace'
  context.textBaseline = 'top'
  context.fillText('+1.0', 8, 8)
  context.fillText(' 0.0', 8, height / 2 + 6)
  context.textBaseline = 'bottom'
  context.fillText('-1.0', 8, height - 8)

  const summary = [
    `${windowMs.toFixed(1)} ms`,
    ...(frequencyHz ? [`${frequencyHz.toFixed(1)} Hz`] : []),
    `mean ${mean >= 0 ? '+' : ''}${mean.toFixed(4)}`,
    `peak ${peak.toFixed(4)}`,
  ].join('   ')
  const metrics = context.measureText(summary)
  context.fillText(summary, Math.max(8, width - metrics.width - 8), height - 8)
}

function findTriggerCrossings({
  samples,
  level,
  slope,
  startIndex,
  endIndex,
}: {
  samples: Float32Array<ArrayBuffer>
  level: number
  slope: 'rising' | 'falling'
  startIndex: number
  endIndex: number
}) {
  const crossings: number[] = []
  let minimum = Infinity
  let maximum = -Infinity
  for (
    let index = Math.max(0, startIndex - 1);
    index <= Math.min(endIndex, samples.length - 1);
    index++
  ) {
    minimum = Math.min(minimum, samples[index])
    maximum = Math.max(maximum, samples[index])
  }
  const hysteresis = Math.max(
    0.0005,
    Math.min(0.02, (maximum - minimum) * 0.01),
  )
  let armed = false

  for (
    let index = Math.max(1, startIndex);
    index <= Math.min(endIndex, samples.length - 1);
    index++
  ) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (slope === 'rising') {
      if (previous <= level - hysteresis) armed = true
      if (!armed || previous >= level || current < level) continue
    } else {
      if (previous >= level + hysteresis) armed = true
      if (!armed || previous <= level || current > level) continue
    }

    const difference = current - previous
    const fraction = difference === 0 ? 0 : (level - previous) / difference
    crossings.push(index - 1 + Math.max(0, Math.min(1, fraction)))
    armed = false
  }

  return crossings
}

function interpolatedSample(
  samples: Float32Array<ArrayBuffer>,
  position: number,
) {
  const lowerIndex = Math.max(
    0,
    Math.min(samples.length - 1, Math.floor(position)),
  )
  const upperIndex = Math.min(lowerIndex + 1, samples.length - 1)
  const mix = position - Math.floor(position)
  return samples[lowerIndex] * (1 - mix) + samples[upperIndex] * mix
}

function periodMatchError(
  samples: Float32Array<ArrayBuffer>,
  latestCrossing: number,
  period: number,
) {
  const comparisonPoints = 64
  let differenceEnergy = 0
  let signalEnergy = 0

  for (let index = 0; index < comparisonPoints; index++) {
    const offset = (index / (comparisonPoints - 1)) * period
    const current = interpolatedSample(samples, latestCrossing - offset)
    const previous = interpolatedSample(
      samples,
      latestCrossing - period - offset,
    )
    const difference = current - previous
    differenceEnergy += difference * difference
    signalEnergy += current * current + previous * previous
  }

  return differenceEnergy / Math.max(signalEnergy, 1e-9)
}

function estimatePeriod(
  samples: Float32Array<ArrayBuffer>,
  crossings: number[],
  validStart: number,
) {
  if (crossings.length < 2) return null
  const latestCrossing = crossings[crossings.length - 1]
  const candidates: Array<{ period: number; error: number }> = []
  const firstCandidate = Math.max(0, crossings.length - 17)

  for (let index = crossings.length - 2; index >= firstCandidate; index--) {
    const period = latestCrossing - crossings[index]
    if (period < 2 || latestCrossing - period * 2 < validStart) continue
    candidates.push({
      period,
      error: periodMatchError(samples, latestCrossing, period),
    })
  }
  if (candidates.length === 0) return null

  const bestError = Math.min(...candidates.map((candidate) => candidate.error))
  const matchingCandidates = candidates
    .filter(
      (candidate) =>
        candidate.error <= Math.max(0.0025, bestError * 1.5),
    )
    .sort((a, b) => a.period - b.period)
  return matchingCandidates[0]?.period ?? null
}

function copyInterpolatedWindow(
  source: Float32Array<ArrayBuffer>,
  destination: Float32Array<ArrayBuffer>,
  start: number,
  span: number,
) {
  for (let index = 0; index < destination.length; index++) {
    const position =
      start +
      (destination.length > 1
        ? (index / (destination.length - 1)) * span
        : 0)
    const lowerIndex = Math.max(
      0,
      Math.min(source.length - 1, Math.floor(position)),
    )
    const upperIndex = Math.min(lowerIndex + 1, source.length - 1)
    const mix = position - Math.floor(position)
    destination[index] =
      source[lowerIndex] * (1 - mix) + source[upperIndex] * mix
  }
}

function copyLatestSamples(
  source: ScopeSampleBuffer,
  destination: Float32Array<ArrayBuffer>,
) {
  destination.fill(0)
  const count = Math.min(source.length, destination.length)
  if (count === 0) return

  const sourceStart =
    (source.writeIndex - count + source.data.length) % source.data.length
  const destinationStart = destination.length - count
  const firstCount = Math.min(count, source.data.length - sourceStart)
  destination.set(
    source.data.subarray(sourceStart, sourceStart + firstCount),
    destinationStart,
  )
  if (firstCount < count) {
    destination.set(
      source.data.subarray(0, count - firstCount),
      destinationStart + firstCount,
    )
  }
}

export default function ScopeCanvas({
  isLive,
  sampleBuffers,
  sampleRate,
  statusMessage,
  timeDivisionMs,
  trigger,
  traces,
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

    const timebaseSampleCount = sampleRate
      ? Math.max(
          2,
          Math.min(
            sampleBuffers.current[0].data.length,
            Math.round(sampleRate * (timeDivisionMs / 1000) * 10),
          ),
        )
      : 2
    const historyLength = sampleRate
      ? Math.min(
          sampleBuffers.current[0].data.length,
          Math.max(timebaseSampleCount * 2, sampleRate * 2),
        )
      : 2
    const traceHistories = sampleBuffers.current.map(
      () => new Float32Array(historyLength),
    )
    let animationFrame = 0
    let lockedPeriod: number | null = null
    let pendingPeriod: number | null = null
    let pendingPeriodFrames = 0
    let heldTraceSamples: Float32Array<ArrayBuffer>[] | null = null
    let heldFrequencyHz: number | null = null
    let heldWindowMs = 0
    let lastTriggerAbsolute: number | null = null

    function stabilizePeriod(candidate: number) {
      if (lockedPeriod === null) {
        lockedPeriod = candidate
        return lockedPeriod
      }

      const ratio = candidate / lockedPeriod
      if (ratio >= 0.85 && ratio <= 1.18) {
        lockedPeriod = lockedPeriod * 0.85 + candidate * 0.15
        pendingPeriod = null
        pendingPeriodFrames = 0
        return lockedPeriod
      }

      if (
        pendingPeriod !== null &&
        Math.abs(candidate - pendingPeriod) / pendingPeriod < 0.05
      ) {
        pendingPeriodFrames += 1
        pendingPeriod = pendingPeriod * 0.75 + candidate * 0.25
      } else {
        pendingPeriod = candidate
        pendingPeriodFrames = 1
      }

      if (pendingPeriodFrames >= 4) {
        lockedPeriod = pendingPeriod
        pendingPeriod = null
        pendingPeriodFrames = 0
      }
      return lockedPeriod
    }

    function draw() {
      context.clearRect(0, 0, width, height)
      drawGrid(context, width, height)

      if (isLive && sampleRate) {
        traces.forEach((trace, traceIndex) => {
          if (trace.enabled || traceIndex === trigger.source) {
            copyLatestSamples(
              sampleBuffers.current[traceIndex],
              traceHistories[traceIndex],
            )
          }
        })

        let windowStart = historyLength - timebaseSampleCount
        let windowSpan = timebaseSampleCount - 1
        let windowSampleCount = timebaseSampleCount
        let frequencyHz: number | null = null
        let triggerCrossing: number | null = null
        const triggerBuffer = sampleBuffers.current[trigger.source]
        const canTrigger =
          trigger.mode !== 'off' &&
          traces[trigger.source]?.enabled &&
          triggerBuffer.length >= 2

        if (canTrigger) {
          const triggerHistory = traceHistories[trigger.source]
          const validStart =
            historyLength - Math.min(triggerBuffer.length, historyLength)
          const crossings = findTriggerCrossings({
            samples: triggerHistory,
            level: trigger.level,
            slope: trigger.slope,
            startIndex: validStart + 1,
            endIndex: historyLength - 1,
          })

          if (crossings.length >= 2) {
            const latestCrossing = crossings[crossings.length - 1]
            const estimatedPeriod = estimatePeriod(
              triggerHistory,
              crossings,
              validStart,
            )
            const stabilizedPeriod = estimatedPeriod
              ? stabilizePeriod(estimatedPeriod)
              : null
            if (stabilizedPeriod) {
              frequencyHz = sampleRate / stabilizedPeriod
            }
            const periodIsLocked =
              estimatedPeriod !== null &&
              stabilizedPeriod !== null &&
              Math.abs(estimatedPeriod - stabilizedPeriod) /
                stabilizedPeriod <
                0.05

            if (
              trigger.viewMode === 'cycle' &&
              estimatedPeriod &&
              periodIsLocked
            ) {
              windowStart = latestCrossing - estimatedPeriod
              windowSpan = estimatedPeriod
              windowSampleCount = Math.max(
                2,
                Math.ceil(estimatedPeriod) + 1,
              )
              triggerCrossing = latestCrossing
            } else {
              const preTriggerSamples = Math.floor(
                timebaseSampleCount * 0.2,
              )
              const latestUsableCrossing = [...crossings]
                .reverse()
                .find(
                  (crossing) =>
                    crossing >= validStart + preTriggerSamples &&
                    crossing +
                      (timebaseSampleCount - preTriggerSamples) <
                      historyLength,
                )
              if (latestUsableCrossing !== undefined) {
                windowStart = latestUsableCrossing - preTriggerSamples
                triggerCrossing = latestUsableCrossing
              }
            }
          }
        }

        const triggerAbsolute =
          triggerCrossing === null
            ? null
            : triggerBuffer.totalSamples - historyLength + triggerCrossing
        const holdoffSamples =
          trigger.viewMode === 'cycle' && lockedPeriod
            ? lockedPeriod * 0.8
            : timebaseSampleCount
        const completedNewAcquisition =
          triggerAbsolute !== null &&
          (lastTriggerAbsolute === null ||
            triggerAbsolute >= lastTriggerAbsolute + holdoffSamples)

        const acquiredSamples = sampleBuffers.current.map(
          () => new Float32Array(windowSampleCount),
        )
        traces.forEach((trace, traceIndex) => {
          if (!trace.enabled) return
          const samples = acquiredSamples[traceIndex]
          copyInterpolatedWindow(
            traceHistories[traceIndex],
            samples,
            windowStart,
            windowSpan,
          )
        })

        if (completedNewAcquisition) {
          heldTraceSamples = acquiredSamples
          heldFrequencyHz = frequencyHz
          heldWindowMs = (windowSpan / sampleRate) * 1000
          lastTriggerAbsolute = triggerAbsolute
        } else if (
          trigger.mode === 'off' ||
          (trigger.mode === 'auto' && heldTraceSamples === null)
        ) {
          heldTraceSamples = acquiredSamples
          heldFrequencyHz = frequencyHz
          heldWindowMs = (windowSpan / sampleRate) * 1000
        }

        let labelSamples: Float32Array<ArrayBuffer> | null = null
        traces.forEach((trace, traceIndex) => {
          if (!trace.enabled || !heldTraceSamples) return
          const samples = heldTraceSamples[traceIndex]
          drawTrace(
            context,
            samples,
            width,
            height,
            trace.color,
          )
          if (samples.length > 0) labelSamples ??= samples
        })
        if (labelSamples) {
          drawLabels({
            context,
            samples: labelSamples,
            windowMs: heldWindowMs,
            frequencyHz: heldFrequencyHz,
            width,
            height,
          })
        }
      } else {
        context.fillStyle = cssColor('--scope-label-color')
        context.font = '12px "Fira Code", monospace'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(statusMessage, width / 2, height / 2)
        context.textAlign = 'start'
      }

      if (isLive) animationFrame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationFrame)
  }, [
    height,
    isLive,
    sampleBuffers,
    sampleRate,
    statusMessage,
    timeDivisionMs,
    trigger,
    traces,
    width,
  ])

  return (
    <CanvasWrap ref={wrapRef}>
      <Canvas ref={canvasRef} aria-label="Live input waveform" />
    </CanvasWrap>
  )
}
