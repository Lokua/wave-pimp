import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'

import Button from '../components/Button'
import FieldLabel from '../components/FieldLabel'
import IconButton from '../components/IconButton'
import NumberBox from '../components/NumberBox'
import Range from '../components/Range'
import Select from '../components/Select'
import { encodeWav } from '../export'
import {
  BIT_DEPTHS,
  SAMPLE_RATES,
  type AudioFile,
  type Settings,
} from '../types'
import useAudioPlayback from '../useAudioPlayback'
import Controls, {
  type GeneratorControlValue,
} from './Controls'
import {
  DEFAULT_DRIVE,
  DEFAULT_HARMONIC_AMOUNT,
  DEFAULT_HARMONIC_ORDER,
  DEFAULT_MIDI_NOTE,
  DEFAULT_PHASE,
  DEFAULT_PULSE_WIDTH,
  DEFAULT_SWEEP_COUNT,
  FRAME_LENGTH,
  MAX_SWEEP_COUNT,
} from './constants'
import { formatMidiNoteDisplay, getMidiNoteFrequency } from './midi'
import Preview from './Preview'
import {
  GENERATOR_SOURCE_DEFINITIONS,
  GENERATOR_SOURCE_ORDER,
  type GeneratorFrameParams,
  type GeneratorParamKey,
  type GeneratorSource,
  renderGeneratorFrame,
} from './synthesis'

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

const PitchControl = styled.div`
  display: grid;
  grid-template-columns: 150px 136px;
  align-items: center;
  gap: 8px;
  margin-right: var(--top-bar-control-margin);
`

const PitchLabel = styled.span`
  font-size: 11px;
  min-width: 136px;
  white-space: nowrap;
`

const Body = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  min-height: 0;
`

const SweepCountControl = styled.div`
  display: inline-grid;
  grid-template-columns: auto 58px;
  align-items: center;
  gap: 6px;
  margin-right: var(--top-bar-control-margin);
  cursor: default;

  &[data-disabled='true'] {
    cursor: not-allowed;
  }
`

const SweepCountLabel = styled(FieldLabel)`
  opacity: 0.72;
  cursor: inherit;

  &[data-disabled='true'] {
    opacity: 0.48;
  }
`

const SweepCountBox = styled(NumberBox)`
  cursor: inherit;
`

const ExportControl = styled.div`
  display: inline-grid;
  grid-template-columns: auto 92px;
  align-items: center;
  gap: 6px;
  margin-right: var(--top-bar-control-margin);
`

type SweepLane = {
  enabled: boolean
  from: number
  to: number
}

type SweepLanes = Partial<Record<GeneratorParamKey, SweepLane>>

function formatDefaultName(source: GeneratorSource, isSweep: boolean) {
  if (isSweep) return `${source}-sweep.wav`
  return `${source}.wav`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snapToControl(value: number, control: GeneratorControlValue) {
  const clamped = clamp(value, control.min, control.max)
  const snapped =
    Math.round((clamped - control.min) / control.step) * control.step +
    control.min
  const normalized = clamp(
    Number(snapped.toFixed(10)),
    control.min,
    control.max,
  )
  return control.isInteger ? Math.round(normalized) : normalized
}

function clampSweepCount(value: number) {
  return clamp(Math.round(value), 2, MAX_SWEEP_COUNT)
}

type GeneratorSampleRate = Settings['sampleRate']
type GeneratorBitDepth = Settings['bitDepth']

type GeneratorProps = {
  audioContext: AudioContext
  source: GeneratorSource
  phase: number
  pulseWidth: number
  harmonicOrder: number
  harmonicAmount: number
  drive: number
  onSourceChange: (v: GeneratorSource) => void
  onPhaseChange: (v: number) => void
  onPulseWidthChange: (v: number) => void
  onHarmonicOrderChange: (v: number) => void
  onHarmonicAmountChange: (v: number) => void
  onDriveChange: (v: number) => void
  onAddFile: (file: AudioFile) => void
}

export default function Generator({
  audioContext,
  source,
  phase,
  pulseWidth,
  harmonicOrder,
  harmonicAmount,
  drive,
  onSourceChange,
  onPhaseChange,
  onPulseWidthChange,
  onHarmonicOrderChange,
  onHarmonicAmountChange,
  onDriveChange,
  onAddFile,
}: GeneratorProps) {
  const [midiNote, setMidiNote] = useState(DEFAULT_MIDI_NOTE)
  const [sweepCount, setSweepCount] = useState(DEFAULT_SWEEP_COUNT)
  const [sampleRate, setSampleRate] = useState<GeneratorSampleRate>(48000)
  const [bitDepth, setBitDepth] = useState<GeneratorBitDepth>(32)
  const [sweepLanes, setSweepLanes] = useState<SweepLanes>({})
  const midiNoteLabel = formatMidiNoteDisplay(midiNote)
  const currentParams = useMemo<GeneratorFrameParams>(
    () => ({
      source,
      phase,
      pulseWidth,
      harmonicOrder,
      harmonicAmount,
      drive,
    }),
    [drive, harmonicAmount, harmonicOrder, phase, pulseWidth, source],
  )
  const sourceOptions = GENERATOR_SOURCE_ORDER.map((sourceKey) => ({
    value: sourceKey,
    label: GENERATOR_SOURCE_DEFINITIONS[sourceKey].label,
  }))
  const allControls: GeneratorControlValue[] = [
    {
      id: 'generate-phase',
      paramKey: 'phase',
      label: 'Phase',
      ariaLabel: 'Phase',
      min: 0,
      max: 1,
      step: 0.001,
      value: phase,
      defaultValue: DEFAULT_PHASE,
      onChange: onPhaseChange,
    },
    {
      id: 'generate-pulse-width',
      paramKey: 'pulseWidth',
      label: 'PW',
      ariaLabel: 'Pulse width',
      min: -1,
      max: 1,
      step: 0.001,
      value: pulseWidth,
      defaultValue: DEFAULT_PULSE_WIDTH,
      onChange: onPulseWidthChange,
    },
    {
      id: 'generate-harmonic-order',
      paramKey: 'harmonicOrder',
      label: 'Harmonic',
      ariaLabel: 'Harmonic order',
      min: 2,
      max: 12,
      step: 1,
      isInteger: true,
      value: harmonicOrder,
      defaultValue: DEFAULT_HARMONIC_ORDER,
      onChange: onHarmonicOrderChange,
    },
    {
      id: 'generate-harmonic-amount',
      paramKey: 'harmonicAmount',
      label: 'Harm Amt',
      ariaLabel: 'Harmonic amount',
      min: -1,
      max: 1,
      step: 0.01,
      value: harmonicAmount,
      defaultValue: DEFAULT_HARMONIC_AMOUNT,
      onChange: onHarmonicAmountChange,
    },
    {
      id: 'generate-drive',
      paramKey: 'drive',
      label: 'Drive',
      ariaLabel: 'Drive',
      min: 0,
      max: 1,
      step: 0.01,
      value: drive,
      defaultValue: DEFAULT_DRIVE,
      onChange: onDriveChange,
    },
  ]
  const activeParamKeys = new Set(
    GENERATOR_SOURCE_DEFINITIONS[source].params,
  )
  const controls = allControls.filter((control) =>
    activeParamKeys.has(control.paramKey),
  )
  const hasActiveSweep = controls.some(
    (control) => sweepLanes[control.paramKey]?.enabled,
  )
  const samples = useMemo(
    () => renderGeneratorFrame(currentParams),
    [currentParams],
  )

  const previewBuffer = useMemo(() => {
    const buffer = audioContext.createBuffer(
      1,
      FRAME_LENGTH,
      sampleRate,
    )
    buffer.copyToChannel(samples, 0)
    return buffer
  }, [audioContext, sampleRate, samples])

  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer: previewBuffer,
  })

  useEffect(() => {
    const loopRegion = {
      startSeconds: 0,
      endSeconds: previewBuffer.duration,
    }

    if (playbackRef.current.isPlaying) {
      playbackRef.current.replaceBuffer(previewBuffer, { loopRegion })
    } else {
      playbackRef.current.setBuffer(previewBuffer)
      playbackRef.current.setLoopRegion(loopRegion)
    }
  }, [playbackRef, previewBuffer])

  useEffect(() => {
    const baseFrequency = sampleRate / FRAME_LENGTH
    const targetFrequency = getMidiNoteFrequency(midiNote)
    playbackRef.current.setPlaybackRate(targetFrequency / baseFrequency)
  }, [midiNote, playbackRef, sampleRate])

  function onClickPlayPause() {
    playbackRef.current.setLoopRegion({
      startSeconds: 0,
      endSeconds: previewBuffer.duration,
    })

    if (playbackState.isPlaying) {
      playbackRef.current.pause()
    } else {
      playbackRef.current.play()
    }
  }

  function changeSource(nextSource: string) {
    if (nextSource in GENERATOR_SOURCE_DEFINITIONS) {
      onSourceChange(nextSource as GeneratorSource)
    }
  }

  function toggleSweepLane(control: GeneratorControlValue) {
    setSweepLanes((prev) => {
      const existing = prev[control.paramKey]
      return {
        ...prev,
        [control.paramKey]: {
          enabled: !(existing?.enabled ?? false),
          from: existing?.from ?? control.min,
          to: existing?.to ?? control.max,
        },
      }
    })
  }

  function changeSweepLane(
    control: GeneratorControlValue,
    field: 'from' | 'to',
    value: number,
  ) {
    setSweepLanes((prev) => {
      const existing = prev[control.paramKey]
      if (!existing) return prev

      return {
        ...prev,
        [control.paramKey]: {
          ...existing,
          [field]: snapToControl(value, control),
        },
      }
    })
  }

  function renderSweepBuffer() {
    const buffer = audioContext.createBuffer(
      1,
      FRAME_LENGTH * sweepCount,
      sampleRate,
    )
    const output = buffer.getChannelData(0)
    const denominator = sweepCount - 1

    for (let frameIndex = 0; frameIndex < sweepCount; frameIndex++) {
      const t = frameIndex / denominator
      const params = { ...currentParams }

      for (const control of controls) {
        const lane = sweepLanes[control.paramKey]
        if (!lane?.enabled) continue
        const value = lane.from + (lane.to - lane.from) * t
        params[control.paramKey] = snapToControl(value, control)
      }

      output.set(renderGeneratorFrame(params), frameIndex * FRAME_LENGTH)
    }

    return buffer
  }

  async function addToFiles() {
    const outputBuffer = hasActiveSweep ? renderSweepBuffer() : previewBuffer
    const bytes = encodeWav(outputBuffer, bitDepth)
    const defaultName = formatDefaultName(source, hasActiveSweep)

    const result = (await window.electron.invoke('save-wav', {
      bytes,
      defaultPath: defaultName,
    })) as { canceled: boolean; path?: string }

    if (result.canceled || !result.path) return

    const name = result.path.split(/[\\/]/).pop() ?? defaultName

    onAddFile({
      id: crypto.randomUUID(),
      name,
      filePath: result.path,
      size: bytes.byteLength,
      type: 'audio/wav',
      duration: outputBuffer.duration,
      sampleRate: outputBuffer.sampleRate,
      bitDepth,
      channels: 1,
      sampleCount: outputBuffer.length,
      audioBuffer: outputBuffer,
    })
  }

  return (
    <Container>
      <Toolbar>
        <IconButton
          type="button"
          name={playbackState.isPlaying ? 'Pause' : 'Play'}
          aria-label={playbackState.isPlaying ? 'Pause' : 'Play'}
          title={playbackState.isPlaying ? 'Pause' : 'Play'}
          onClick={onClickPlayPause}
        />
        <PitchControl>
          <Range
            type="range"
            min={0}
            max={127}
            step={1}
            value={midiNote}
            aria-label="MIDI note"
            onChange={(event) => setMidiNote(Number(event.target.value))}
          />
          <PitchLabel>{midiNoteLabel}</PitchLabel>
        </PitchControl>
        <SweepCountControl
          data-disabled={!hasActiveSweep}
          title={
            hasActiveSweep
              ? 'Number of generated wavetable frames'
              : 'Enable a sweep lane to use sweep count'
          }
        >
          <SweepCountLabel
            htmlFor="generate-sweep-count"
            data-disabled={!hasActiveSweep}
          >
            Sweep
          </SweepCountLabel>
          <SweepCountBox
            id="generate-sweep-count"
            min={2}
            max={MAX_SWEEP_COUNT}
            step={1}
            value={sweepCount}
            disabled={!hasActiveSweep}
            onChange={(value) => setSweepCount(clampSweepCount(value))}
            aria-label="Sweep count"
          />
        </SweepCountControl>
        <ExportControl>
          <FieldLabel htmlFor="generate-sample-rate">Rate</FieldLabel>
          <Select
            id="generate-sample-rate"
            value={String(sampleRate)}
            options={SAMPLE_RATES.map((value) => ({
              value: String(value),
              label: `${value.toLocaleString()} Hz`,
            }))}
            onChange={(value) =>
              setSampleRate(Number(value) as GeneratorSampleRate)
            }
            aria-label="Generator sample rate"
          />
        </ExportControl>
        <ExportControl>
          <FieldLabel htmlFor="generate-bit-depth">Depth</FieldLabel>
          <Select
            id="generate-bit-depth"
            value={String(bitDepth)}
            options={BIT_DEPTHS.map((value) => ({
              value: String(value),
              label: `${value}-bit`,
            }))}
            onChange={(value) =>
              setBitDepth(Number(value) as GeneratorBitDepth)
            }
            aria-label="Generator bit depth"
          />
        </ExportControl>
        <Button type="button" onClick={addToFiles}>
          Generate
        </Button>
      </Toolbar>
      <Body>
        <Controls
          source={source}
          sourceOptions={sourceOptions}
          controls={controls}
          sweepLanes={sweepLanes}
          onSourceChange={changeSource}
          onToggleSweepLane={toggleSweepLane}
          onChangeSweepLane={changeSweepLane}
        />
        <Preview samples={samples} sampleRate={sampleRate} />
      </Body>
    </Container>
  )
}
