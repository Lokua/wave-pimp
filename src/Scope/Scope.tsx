import styled from '@emotion/styled'
import { useEffect, useRef, useState } from 'react'

import FieldLabel from '../components/FieldLabel'
import Range from '../components/Range'
import Select from '../components/Select'
import ScopeCanvas from './ScopeCanvas'
import type { ScopeSampleBuffer } from './ScopeCanvas'

const SELECTED_DEVICE_KEY = 'wave-pimp:scope-native-device'
const TRACE_CHANNELS_KEY_PREFIX = 'wave-pimp:scope-trace-channels:'
const TIME_DIVISION_KEY = 'wave-pimp:scope-time-division-ms'
const TRIGGER_MODE_KEY = 'wave-pimp:scope-trigger-mode'
const TRIGGER_SOURCE_KEY = 'wave-pimp:scope-trigger-source'
const TRIGGER_SLOPE_KEY = 'wave-pimp:scope-trigger-slope'
const TRIGGER_LEVEL_KEY = 'wave-pimp:scope-trigger-level'
const VIEW_MODE_KEY = 'wave-pimp:scope-view-mode'
const SCOPE_BUFFER_LENGTH = 262144
const SCOPE_TRACE_COUNT = 4
const DEFAULT_SAMPLE_RATE = 48000
const MAX_TIME_DIVISION_MS = 100
const TIME_SLIDER_STEPS = 1000
const SCOPE_SLIDER_WIDTH = 140
const TRACE_COLORS = [
  '--scope-trace-red',
  '--scope-trace-green',
  '--scope-trace-yellow',
  '--scope-trace-blue',
]

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
  min-height: 32px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border-color);
`

const Footer = styled(Toolbar)`
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border-color);
  border-bottom: 0;
`

const TimebaseControl = styled.div`
  display: grid;
  grid-template-columns: auto ${SCOPE_SLIDER_WIDTH}px 74px;
  align-items: center;
  gap: 10px;

  &[data-disabled='true'] {
    opacity: 0.45;
  }
`

const TimebaseValue = styled.output`
  font-size: 10px;
  color: var(--text-color);
  text-align: right;
`

const SelectControl = styled.div<{ width: number }>`
  display: grid;
  grid-template-columns: auto ${({ width }) => width}px;
  align-items: center;
  gap: 6px;
  margin-right: var(--top-bar-control-margin);
`

const TriggerLevelControl = styled.div`
  display: grid;
  grid-template-columns: auto ${SCOPE_SLIDER_WIDTH}px 46px;
  align-items: center;
  gap: 6px;
  margin-right: var(--top-bar-control-margin);
`

const TriggerLevelValue = styled.output`
  font-size: 10px;
  text-align: right;
`

const TraceControl = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: 6px;
`

const TraceLabel = styled.span<{ color: string }>`
  color: ${({ color }) => `var(${color})`};
  font-size: 10px;
  font-weight: 600;
`

const TraceToggle = styled.button<{ enabled: boolean; color: string }>`
  height: 22px;
  min-width: 32px;
  padding: 0 5px;
  border: 1px solid
    ${({ enabled, color }) =>
      enabled ? `var(${color})` : 'var(--border-color)'};
  background: ${({ enabled }) =>
    enabled ? 'var(--button-active)' : 'var(--button-bg)'};
  color: ${({ enabled, color }) =>
    enabled ? `var(${color})` : 'var(--text-color)'};
  font-size: 9px;
  opacity: ${({ enabled }) => (enabled ? 1 : 0.65)};

  &:focus {
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--text-color);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
`

const Status = styled.span<{ hasError: boolean }>`
  margin-left: auto;
  font-size: 10px;
  color: ${({ hasError }) =>
    hasError ? 'var(--cursor-color)' : 'var(--text-color)'};
  opacity: ${({ hasError }) => (hasError ? 1 : 0.7)};
`

const Display = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 12px;
`

type ScopeInputDevice = {
  id: number
  name: string
  maxInputChannels: number
  defaultSampleRate: number
}

type ScopeStartResult = {
  channelCount: number
  sampleRate: number
}

type ScopeTrace = {
  channel: number
  enabled: boolean
}

type TriggerMode = 'auto' | 'normal' | 'off'
type TriggerSlope = 'rising' | 'falling'
type ScopeViewMode = 'time' | 'cycle'

function traceChannelsKey(deviceName: string) {
  return `${TRACE_CHANNELS_KEY_PREFIX}${deviceName}`
}

function loadTraceSettings(
  device: ScopeInputDevice,
  currentTraces: ScopeTrace[],
) {
  let savedTraces: unknown = null
  try {
    const saved = localStorage.getItem(traceChannelsKey(device.name))
    if (saved) savedTraces = JSON.parse(saved)
  } catch {
    // Ignore malformed saved settings and restore safe defaults.
  }

  return currentTraces.map((trace, index) => {
    const savedTrace = Array.isArray(savedTraces)
      ? savedTraces[index]
      : null
    const savedChannel = Number.isInteger(savedTrace)
      ? Number(savedTrace)
      : typeof savedTrace === 'object' &&
          savedTrace !== null &&
          'channel' in savedTrace &&
          Number.isInteger(savedTrace.channel)
        ? Number(savedTrace.channel)
        : index
    const savedEnabled =
      typeof savedTrace === 'object' &&
      savedTrace !== null &&
      'enabled' in savedTrace &&
      typeof savedTrace.enabled === 'boolean'
        ? savedTrace.enabled
        : true
    return {
      ...trace,
      channel: Math.max(
        0,
        Math.min(savedChannel, device.maxInputChannels - 1),
      ),
      enabled: savedEnabled,
    }
  })
}

function saveTraceSettings(deviceName: string, traces: ScopeTrace[]) {
  localStorage.setItem(
    traceChannelsKey(deviceName),
    JSON.stringify(
      traces.map(({ channel, enabled }) => ({ channel, enabled })),
    ),
  )
}

function loadTimeDivision() {
  const saved = Number(localStorage.getItem(TIME_DIVISION_KEY))
  return Number.isFinite(saved) && saved > 0 && saved <= MAX_TIME_DIVISION_MS
    ? saved
    : 10
}

function loadTriggerMode(): TriggerMode {
  const saved = localStorage.getItem(TRIGGER_MODE_KEY)
  if (saved === 'off') return 'off'
  return saved === 'auto' ? 'auto' : 'normal'
}

function loadTriggerSource() {
  const saved = Number(localStorage.getItem(TRIGGER_SOURCE_KEY))
  return Number.isInteger(saved) && saved >= 0 && saved < SCOPE_TRACE_COUNT
    ? saved
    : 0
}

function loadTriggerSlope(): TriggerSlope {
  return localStorage.getItem(TRIGGER_SLOPE_KEY) === 'falling'
    ? 'falling'
    : 'rising'
}

function loadTriggerLevel() {
  const saved = Number(localStorage.getItem(TRIGGER_LEVEL_KEY))
  return Number.isFinite(saved) && saved >= -1 && saved <= 1 ? saved : 0
}

function loadViewMode(): ScopeViewMode {
  return localStorage.getItem(VIEW_MODE_KEY) === 'cycle' ? 'cycle' : 'time'
}

function sliderToTimeDivision(position: number, minimum: number) {
  const ratio = MAX_TIME_DIVISION_MS / minimum
  return minimum * ratio ** (position / TIME_SLIDER_STEPS)
}

function timeDivisionToSlider(timeDivision: number, minimum: number) {
  const clamped = Math.max(
    minimum,
    Math.min(timeDivision, MAX_TIME_DIVISION_MS),
  )
  return (
    (Math.log(clamped / minimum) /
      Math.log(MAX_TIME_DIVISION_MS / minimum)) *
    TIME_SLIDER_STEPS
  )
}

function formatTimeDivision(milliseconds: number) {
  if (milliseconds < 1) return `${(milliseconds * 1000).toFixed(1)} µs/div`
  return `${milliseconds.toFixed(milliseconds < 10 ? 2 : 1)} ms/div`
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function resetSampleBuffer(buffer: ScopeSampleBuffer) {
  buffer.data.fill(0)
  buffer.length = 0
  buffer.totalSamples = 0
  buffer.writeIndex = 0
}

function createSampleBuffer(): ScopeSampleBuffer {
  return {
    data: new Float32Array(SCOPE_BUFFER_LENGTH),
    length: 0,
    totalSamples: 0,
    writeIndex: 0,
  }
}

function getFloatSamples(value: unknown) {
  if (value instanceof ArrayBuffer) return new Float32Array(value)
  if (value instanceof Float32Array) return value
  if (ArrayBuffer.isView(value)) {
    return new Float32Array(
      value.buffer,
      value.byteOffset,
      Math.floor(value.byteLength / Float32Array.BYTES_PER_ELEMENT),
    )
  }
  return null
}

export default function Scope() {
  const [devices, setDevices] = useState<ScopeInputDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [traces, setTraces] = useState<ScopeTrace[]>(() =>
    Array.from({ length: SCOPE_TRACE_COUNT }, (_, index) => ({
      channel: index,
      enabled: true,
    })),
  )
  const [channelCount, setChannelCount] = useState(1)
  const [sampleRate, setSampleRate] = useState<number | null>(null)
  const [status, setStatus] = useState('Finding audio inputs...')
  const [error, setError] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [timeDivisionMs, setTimeDivisionMs] = useState(loadTimeDivision)
  const [triggerMode, setTriggerMode] =
    useState<TriggerMode>(loadTriggerMode)
  const [triggerSource, setTriggerSource] = useState(loadTriggerSource)
  const [triggerSlope, setTriggerSlope] =
    useState<TriggerSlope>(loadTriggerSlope)
  const [triggerLevel, setTriggerLevel] = useState(loadTriggerLevel)
  const [viewMode, setViewMode] = useState<ScopeViewMode>(loadViewMode)
  const tracesRef = useRef(traces)
  const sampleBuffersRef = useRef<ScopeSampleBuffer[]>(
    Array.from({ length: SCOPE_TRACE_COUNT }, createSampleBuffer),
  )

  useEffect(() => {
    let cancelled = false

    const handleSamples = (...args: unknown[]) => {
      const traceIndex = args[1]
      if (
        typeof traceIndex !== 'number' ||
        traceIndex < 0 ||
        traceIndex >= SCOPE_TRACE_COUNT
      ) {
        return
      }
      const samples = getFloatSamples(args[2])
      if (!samples) return
      const buffer = sampleBuffersRef.current[traceIndex]
      for (const sample of samples) {
        buffer.data[buffer.writeIndex] = sample
        buffer.writeIndex = (buffer.writeIndex + 1) % buffer.data.length
        buffer.length = Math.min(buffer.length + 1, buffer.data.length)
      }
      buffer.totalSamples += samples.length
    }
    const handleCaptureError = (...args: unknown[]) => {
      setStatus(typeof args[1] === 'string' ? args[1] : 'Audio input failed.')
      setError(true)
      setIsLive(false)
    }

    window.electron.on('scope-samples', handleSamples)
    window.electron.on('scope-error', handleCaptureError)

    async function loadDevices() {
      try {
        const inputs = (await window.electron.invoke(
          'scope-list-input-devices',
        )) as ScopeInputDevice[]
        if (cancelled) return
        setDevices(inputs)
        if (inputs.length === 0) {
          setStatus('No Core Audio inputs were found.')
          setError(true)
          return
        }

        const savedName = localStorage.getItem(SELECTED_DEVICE_KEY)
        const selected =
          inputs.find((device) => device.name === savedName) ?? inputs[0]
        const initialTraces = loadTraceSettings(selected, tracesRef.current)
        tracesRef.current = initialTraces
        setTraces(initialTraces)
        setSelectedDeviceId(String(selected.id))
        setChannelCount(selected.maxInputChannels)
        setStatus('Opening audio input...')
      } catch (loadError) {
        if (cancelled) return
        setStatus(describeError(loadError))
        setError(true)
      }
    }

    void loadDevices()
    return () => {
      cancelled = true
      window.electron.off('scope-samples', handleSamples)
      window.electron.off('scope-error', handleCaptureError)
      void window.electron.invoke('scope-stop')
    }
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return
    const device = devices.find(
      (candidate) => candidate.id === Number(selectedDeviceId),
    )
    if (!device) return
    const captureDevice = device

    let cancelled = false
    sampleBuffersRef.current.forEach(resetSampleBuffer)
    setIsLive(false)
    setError(false)
    setStatus('Opening audio input...')

    async function startCapture() {
      try {
        const result = (await window.electron.invoke('scope-start', {
          deviceId: captureDevice.id,
          traces: tracesRef.current,
        })) as ScopeStartResult
        if (cancelled) return
        setChannelCount(result.channelCount)
        setSampleRate(result.sampleRate)
        setStatus('Live')
        setError(false)
        setIsLive(true)
      } catch (captureError) {
        if (cancelled) return
        setStatus(describeError(captureError))
        setError(true)
        setSampleRate(null)
      }
    }

    void startCapture()
    return () => {
      cancelled = true
      void window.electron.invoke('scope-stop')
    }
  }, [devices, selectedDeviceId])

  function selectDevice(deviceId: string) {
    const device = devices.find(
      (candidate) => candidate.id === Number(deviceId),
    )
    if (!device) return

    localStorage.setItem(SELECTED_DEVICE_KEY, device.name)
    const nextTraces = loadTraceSettings(device, tracesRef.current)
    tracesRef.current = nextTraces
    setTraces(nextTraces)
    setChannelCount(device.maxInputChannels)
    setSelectedDeviceId(deviceId)
  }

  function updateTrace(traceIndex: number, update: Partial<ScopeTrace>) {
    const nextTraces = tracesRef.current.map((trace, index) =>
      index === traceIndex ? { ...trace, ...update } : trace,
    )
    tracesRef.current = nextTraces
    setTraces(nextTraces)
    const device = devices.find(
      (candidate) => candidate.id === Number(selectedDeviceId),
    )
    if (device) saveTraceSettings(device.name, nextTraces)
    resetSampleBuffer(sampleBuffersRef.current[traceIndex])
    void window.electron.invoke('scope-set-traces', nextTraces).catch(
      (selectError: unknown) => {
        setStatus(describeError(selectError))
        setError(true)
        setIsLive(false)
      },
    )
  }

  function selectChannel(traceIndex: number, value: string) {
    const channel = Number(value)
    updateTrace(traceIndex, { channel })
  }

  function selectTimeDivision(nextTimeDivision: number) {
    setTimeDivisionMs(nextTimeDivision)
    localStorage.setItem(TIME_DIVISION_KEY, String(nextTimeDivision))
  }

  const deviceOptions = devices.map((device) => ({
    value: String(device.id),
    label: device.name,
  }))
  const channelOptions = Array.from({ length: channelCount }, (_, index) => ({
    value: String(index),
    label: `Input ${index + 1}`,
  }))
  const minimumTimeDivisionMs =
    200 / (sampleRate ?? DEFAULT_SAMPLE_RATE)
  const effectiveTimeDivisionMs = Math.max(
    minimumTimeDivisionMs,
    Math.min(timeDivisionMs, MAX_TIME_DIVISION_MS),
  )
  const timeSliderValue = timeDivisionToSlider(
    effectiveTimeDivisionMs,
    minimumTimeDivisionMs,
  )

  return (
    <Container>
      <Toolbar>
        <TimebaseControl data-disabled={viewMode === 'cycle'}>
          <FieldLabel htmlFor="scope-time-division">Time/div</FieldLabel>
          <Range
            id="scope-time-division"
            type="range"
            min={0}
            max={TIME_SLIDER_STEPS}
            step={1}
            value={timeSliderValue}
            disabled={viewMode === 'cycle'}
            onChange={(event) =>
              selectTimeDivision(
                sliderToTimeDivision(
                  Number(event.currentTarget.value),
                  minimumTimeDivisionMs,
                ),
              )
            }
            aria-label="Scope time per division"
          />
          <TimebaseValue htmlFor="scope-time-division">
            {viewMode === 'cycle'
              ? 'Automatic'
              : formatTimeDivision(effectiveTimeDivisionMs)}
          </TimebaseValue>
        </TimebaseControl>
        <SelectControl width={64}>
          <FieldLabel htmlFor="scope-trigger-mode">Trigger</FieldLabel>
          <Select
            id="scope-trigger-mode"
            value={triggerMode}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'auto', label: 'Auto' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={(value) => {
              const mode = value as TriggerMode
              setTriggerMode(mode)
              localStorage.setItem(TRIGGER_MODE_KEY, mode)
            }}
          />
        </SelectControl>
        <SelectControl width={54}>
          <FieldLabel htmlFor="scope-trigger-source">Source</FieldLabel>
          <Select
            id="scope-trigger-source"
            value={String(triggerSource)}
            options={traces.map((_, index) => ({
              value: String(index),
              label: `T${index + 1}`,
            }))}
            onChange={(value) => {
              const source = Number(value)
              setTriggerSource(source)
              localStorage.setItem(TRIGGER_SOURCE_KEY, String(source))
            }}
            disabled={triggerMode === 'off'}
          />
        </SelectControl>
        <SelectControl width={82}>
          <FieldLabel htmlFor="scope-trigger-slope">Slope</FieldLabel>
          <Select
            id="scope-trigger-slope"
            value={triggerSlope}
            options={[
              { value: 'rising', label: 'Rising' },
              { value: 'falling', label: 'Falling' },
            ]}
            onChange={(value) => {
              const slope = value as TriggerSlope
              setTriggerSlope(slope)
              localStorage.setItem(TRIGGER_SLOPE_KEY, slope)
            }}
            disabled={triggerMode === 'off'}
          />
        </SelectControl>
        <TriggerLevelControl>
          <FieldLabel htmlFor="scope-trigger-level">Level</FieldLabel>
          <Range
            id="scope-trigger-level"
            type="range"
            min={-1}
            max={1}
            step={0.001}
            value={triggerLevel}
            disabled={triggerMode === 'off'}
            onChange={(event) => {
              const level = Number(event.currentTarget.value)
              setTriggerLevel(level)
              localStorage.setItem(TRIGGER_LEVEL_KEY, String(level))
            }}
          />
          <TriggerLevelValue htmlFor="scope-trigger-level">
            {triggerLevel >= 0 ? '+' : ''}
            {triggerLevel.toFixed(3)}
          </TriggerLevelValue>
        </TriggerLevelControl>
        <SelectControl width={90}>
          <FieldLabel htmlFor="scope-view-mode">View</FieldLabel>
          <Select
            id="scope-view-mode"
            value={viewMode}
            options={[
              { value: 'time', label: 'Time/div' },
              { value: 'cycle', label: 'One Cycle' },
            ]}
            onChange={(value) => {
              const mode = value as ScopeViewMode
              setViewMode(mode)
              localStorage.setItem(VIEW_MODE_KEY, mode)
            }}
            disabled={triggerMode === 'off'}
          />
        </SelectControl>
      </Toolbar>
      <Display>
        <ScopeCanvas
          isLive={isLive}
          sampleBuffers={sampleBuffersRef}
          sampleRate={sampleRate}
          statusMessage={status}
          timeDivisionMs={effectiveTimeDivisionMs}
          trigger={{
            level: triggerLevel,
            mode: triggerMode,
            slope: triggerSlope,
            source: triggerSource,
            viewMode,
          }}
          traces={traces.map((trace, index) => ({
            enabled: trace.enabled,
            color: TRACE_COLORS[index],
          }))}
        />
      </Display>
      <Footer>
        <SelectControl width={240}>
          <FieldLabel htmlFor="scope-device">Device</FieldLabel>
          <Select
            id="scope-device"
            value={selectedDeviceId}
            options={deviceOptions}
            onChange={selectDevice}
            aria-label="Core Audio input device"
            disabled={devices.length === 0}
          />
        </SelectControl>
        {traces.map((trace, traceIndex) => (
          <TraceControl key={traceIndex}>
            <TraceLabel color={TRACE_COLORS[traceIndex]}>
              T{traceIndex + 1}
            </TraceLabel>
            <Select
              id={`scope-channel-${traceIndex}`}
              value={String(trace.channel)}
              options={channelOptions}
              onChange={(value) => selectChannel(traceIndex, value)}
              aria-label={`Trace ${traceIndex + 1} audio input channel`}
              disabled={!isLive}
            />
            <TraceToggle
              type="button"
              enabled={trace.enabled}
              color={TRACE_COLORS[traceIndex]}
              disabled={!isLive}
              aria-pressed={trace.enabled}
              aria-label={`${trace.enabled ? 'Turn off' : 'Turn on'} trace ${traceIndex + 1}`}
              onClick={() =>
                updateTrace(traceIndex, { enabled: !trace.enabled })
              }
            >
              {trace.enabled ? 'ON' : 'OFF'}
            </TraceToggle>
          </TraceControl>
        ))}
        <Status hasError={error}>{status}</Status>
      </Footer>
    </Container>
  )
}
