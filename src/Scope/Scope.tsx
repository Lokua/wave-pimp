import styled from '@emotion/styled'
import { useEffect, useRef, useState } from 'react'

import FieldLabel from '../components/FieldLabel'
import Select from '../components/Select'
import ScopeCanvas from './ScopeCanvas'

const SELECTED_DEVICE_KEY = 'wave-pimp:scope-device'
const MAX_CAPTURE_CHANNELS = 32
const FFT_SIZE = 32768

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

const SelectControl = styled.div<{ width: number }>`
  display: grid;
  grid-template-columns: auto ${({ width }) => width}px;
  align-items: center;
  gap: 6px;
  margin-right: var(--top-bar-control-margin);
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

type CaptureGraph = {
  audioContext: AudioContext
  source: MediaStreamAudioSourceNode
  splitter: ChannelSplitterNode
  analyser: AnalyserNode
  stream: MediaStream
}

function stopCapture(graph: CaptureGraph | null) {
  if (!graph) return
  graph.source.disconnect()
  graph.splitter.disconnect()
  graph.analyser.disconnect()
  graph.stream.getTracks().forEach((track) => track.stop())
  void graph.audioContext.close().catch(() => undefined)
}

function describeCaptureError(error: unknown) {
  if (!(error instanceof DOMException)) return 'Unable to open audio input.'
  if (error.name === 'NotAllowedError') return 'Microphone access was denied.'
  if (error.name === 'NotFoundError') return 'No audio input was found.'
  if (error.name === 'NotReadableError') return 'Audio input is unavailable.'
  if (error.name === 'OverconstrainedError') {
    return 'The selected input does not support the requested format.'
  }
  return error.message || 'Unable to open audio input.'
}

function loadSelectedDevice() {
  return localStorage.getItem(SELECTED_DEVICE_KEY) ?? ''
}

export default function Scope() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] =
    useState(loadSelectedDevice)
  const [selectedChannel, setSelectedChannel] = useState(0)
  const [channelCount, setChannelCount] = useState(1)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [sampleRate, setSampleRate] = useState<number | null>(null)
  const [status, setStatus] = useState('Waiting for audio input...')
  const [error, setError] = useState(false)
  const graphRef = useRef<CaptureGraph | null>(null)
  const selectedChannelRef = useRef(selectedChannel)

  useEffect(() => {
    selectedChannelRef.current = selectedChannel
  }, [selectedChannel])

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices) {
      setStatus('Audio capture is not available.')
      setError(true)
      return
    }

    let cancelled = false

    async function refreshDevices() {
      try {
        const available = await mediaDevices.enumerateDevices()
        if (cancelled) return
        setDevices(
          available.filter((device) => device.kind === 'audioinput'),
        )
      } catch {
        // Device labels and enumeration may be unavailable before permission.
      }
    }

    void refreshDevices()
    mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => {
      cancelled = true
      mediaDevices.removeEventListener('devicechange', refreshDevices)
    }
  }, [])

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices) return

    let cancelled = false
    setStatus('Opening audio input...')
    setError(false)
    setAnalyser(null)
    stopCapture(graphRef.current)
    graphRef.current = null

    async function startCapture() {
      let pendingStream: MediaStream | null = null
      let pendingContext: AudioContext | null = null

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: {
            autoGainControl: false,
            channelCount: { ideal: MAX_CAPTURE_CHANNELS },
            deviceId: selectedDeviceId
              ? { exact: selectedDeviceId }
              : undefined,
            echoCancellation: false,
            noiseSuppression: false,
          },
          video: false,
        })
        pendingStream = stream

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const audioContext = new AudioContext({ latencyHint: 'interactive' })
        pendingContext = audioContext
        await audioContext.resume()
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          await audioContext.close()
          return
        }

        const source = audioContext.createMediaStreamSource(stream)
        const count = Math.max(
          1,
          Math.min(
            MAX_CAPTURE_CHANNELS,
            stream.getAudioTracks()[0]?.getSettings().channelCount ??
              source.channelCount,
          ),
        )
        const splitter = audioContext.createChannelSplitter(count)
        const nextAnalyser = audioContext.createAnalyser()
        nextAnalyser.fftSize = FFT_SIZE
        nextAnalyser.smoothingTimeConstant = 0
        source.connect(splitter)
        splitter.connect(
          nextAnalyser,
          Math.min(selectedChannelRef.current, count - 1),
        )

        const graph = {
          audioContext,
          source,
          splitter,
          analyser: nextAnalyser,
          stream,
        }
        graphRef.current = graph
        pendingStream = null
        pendingContext = null
        setChannelCount(count)
        setSelectedChannel((channel) => Math.min(channel, count - 1))
        setSampleRate(audioContext.sampleRate)
        setAnalyser(nextAnalyser)
        setStatus('Live')
        setError(false)

        const available = await mediaDevices.enumerateDevices()
        if (!cancelled) {
          setDevices(
            available.filter((device) => device.kind === 'audioinput'),
          )
        }

        stream.getAudioTracks()[0]?.addEventListener('ended', () => {
          if (cancelled) return
          setAnalyser(null)
          setStatus('Audio input was disconnected.')
          setError(true)
        })
      } catch (captureError) {
        pendingStream?.getTracks().forEach((track) => track.stop())
        if (pendingContext) {
          void pendingContext.close().catch(() => undefined)
        }
        if (cancelled) return
        setStatus(describeCaptureError(captureError))
        setError(true)
        setSampleRate(null)
      }
    }

    void startCapture()
    return () => {
      cancelled = true
      stopCapture(graphRef.current)
      graphRef.current = null
    }
  }, [selectedDeviceId])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.splitter.disconnect()
    graph.splitter.connect(
      graph.analyser,
      Math.min(selectedChannel, channelCount - 1),
    )
  }, [channelCount, selectedChannel])

  function selectDevice(deviceId: string) {
    setSelectedDeviceId(deviceId)
    setSelectedChannel(0)
    if (deviceId) localStorage.setItem(SELECTED_DEVICE_KEY, deviceId)
    else localStorage.removeItem(SELECTED_DEVICE_KEY)
  }

  const deviceOptions = [
    { value: '', label: 'System default' },
    ...devices.map((device, index) => ({
      value: device.deviceId,
      label: device.label || `Audio input ${index + 1}`,
    })),
  ]
  const channelOptions = Array.from({ length: channelCount }, (_, index) => ({
    value: String(index),
    label: `Channel ${index + 1}`,
  }))

  return (
    <Container>
      <Toolbar>
        <SelectControl width={240}>
          <FieldLabel htmlFor="scope-device">Input</FieldLabel>
          <Select
            id="scope-device"
            value={selectedDeviceId}
            options={deviceOptions}
            onChange={selectDevice}
            aria-label="Audio input device"
          />
        </SelectControl>
        <SelectControl width={100}>
          <FieldLabel htmlFor="scope-channel">Channel</FieldLabel>
          <Select
            id="scope-channel"
            value={String(selectedChannel)}
            options={channelOptions}
            onChange={(value) => setSelectedChannel(Number(value))}
            aria-label="Audio input channel"
            disabled={!analyser}
          />
        </SelectControl>
        <Status hasError={error}>{status}</Status>
      </Toolbar>
      <Display>
        <ScopeCanvas
          analyser={analyser}
          sampleRate={sampleRate}
          statusMessage={status}
        />
      </Display>
    </Container>
  )
}
