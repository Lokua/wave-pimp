import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'

import Button from '../components/Button'
import FieldLabel from '../components/FieldLabel'
import IconButton from '../components/IconButton'
import NumberBox from '../components/NumberBox'
import Range from '../components/Range'
import { encodeWav } from '../export'
import type { AudioFile, Settings } from '../types'
import useAudioPlayback from '../useAudioPlayback'
import Controls, { type GeneratorControlValue } from './Controls'
import Preview from './Preview'
import {
  DEFAULT_DRIVE,
  DEFAULT_FM_AMOUNT,
  DEFAULT_FM_RATIO,
  DEFAULT_FOLD,
  DEFAULT_HARMONIC_COUNT,
  DEFAULT_MIDI_NOTE,
  DEFAULT_ODD_EVEN_BALANCE,
  DEFAULT_PHASE_DISTORTION,
  DEFAULT_ROLLOFF,
  DEFAULT_SWEEP_COUNT,
  FRAME_LENGTH,
  MAX_SWEEP_COUNT,
} from './constants'
import { formatMidiNoteDisplay, getMidiNoteFrequency } from './midi'
import {
  type AdditiveFrameParams,
  renderAdditiveFrame,
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

type SweepLane = {
  enabled: boolean
  from: number
  to: number
}

type SweepLanes = Partial<Record<keyof AdditiveFrameParams, SweepLane>>

function formatDefaultName(frameNumber: number, isSweep: boolean) {
  if (isSweep) return 'sweep.wav'
  return `frame-${String(frameNumber).padStart(3, '0')}.wav`
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

type GeneratorProps = {
  settings: Settings
  audioContext: AudioContext
  nextFrameNumber: number
  harmonicCount: number
  rolloff: number
  oddEvenBalance: number
  phaseDistortion: number
  fmAmount: number
  fmRatio: number
  drive: number
  fold: number
  onHarmonicCountChange: (v: number) => void
  onRolloffChange: (v: number) => void
  onOddEvenBalanceChange: (v: number) => void
  onPhaseDistortionChange: (v: number) => void
  onFmAmountChange: (v: number) => void
  onFmRatioChange: (v: number) => void
  onDriveChange: (v: number) => void
  onFoldChange: (v: number) => void
  onAddFile: (file: AudioFile) => void
}

export default function Generator({
  settings,
  audioContext,
  nextFrameNumber,
  harmonicCount,
  rolloff,
  oddEvenBalance,
  phaseDistortion,
  fmAmount,
  fmRatio,
  drive,
  fold,
  onHarmonicCountChange,
  onRolloffChange,
  onOddEvenBalanceChange,
  onPhaseDistortionChange,
  onFmAmountChange,
  onFmRatioChange,
  onDriveChange,
  onFoldChange,
  onAddFile,
}: GeneratorProps) {
  const [midiNote, setMidiNote] = useState(DEFAULT_MIDI_NOTE)
  const [sweepCount, setSweepCount] = useState(DEFAULT_SWEEP_COUNT)
  const [sweepLanes, setSweepLanes] = useState<SweepLanes>({})
  const midiNoteLabel = formatMidiNoteDisplay(midiNote)
  const currentParams = useMemo<AdditiveFrameParams>(
    () => ({
      harmonicCount,
      rolloff,
      oddEvenBalance,
      phaseDistortion,
      fmAmount,
      fmRatio,
      drive,
      fold,
    }),
    [
      drive,
      fmAmount,
      fmRatio,
      fold,
      harmonicCount,
      oddEvenBalance,
      phaseDistortion,
      rolloff,
    ],
  )
  const hasActiveSweep = Object.values(sweepLanes).some(
    (lane) => lane?.enabled,
  )

  const samples = useMemo(
    () => renderAdditiveFrame(currentParams),
    [currentParams],
  )

  const previewBuffer = useMemo(() => {
    const buffer = audioContext.createBuffer(
      1,
      FRAME_LENGTH,
      settings.sampleRate,
    )
    buffer.copyToChannel(samples, 0)
    return buffer
  }, [audioContext, samples, settings.sampleRate])

  const { playback: playbackRef, ...playbackState } = useAudioPlayback({
    audioContext,
    audioBuffer: previewBuffer,
  })

  const controls: GeneratorControlValue[] = [
    {
      id: 'generate-harmonics',
      paramKey: 'harmonicCount',
      label: 'Harmonics',
      ariaLabel: 'Harmonics',
      min: 1,
      max: 64,
      step: 1,
      isInteger: true,
      value: harmonicCount,
      defaultValue: DEFAULT_HARMONIC_COUNT,
      onChange: onHarmonicCountChange,
    },
    {
      id: 'generate-rolloff',
      paramKey: 'rolloff',
      label: 'Rolloff',
      ariaLabel: 'Rolloff',
      min: 0,
      max: 3,
      step: 0.05,
      value: rolloff,
      defaultValue: DEFAULT_ROLLOFF,
      onChange: onRolloffChange,
    },
    {
      id: 'generate-odd-even',
      paramKey: 'oddEvenBalance',
      label: 'Odd/Even',
      ariaLabel: 'Odd/even balance',
      min: -1,
      max: 1,
      step: 0.05,
      value: oddEvenBalance,
      defaultValue: DEFAULT_ODD_EVEN_BALANCE,
      onChange: onOddEvenBalanceChange,
    },
    {
      id: 'generate-phase-distortion',
      paramKey: 'phaseDistortion',
      label: 'Phase Distortion',
      ariaLabel: 'Phase distortion',
      min: -1,
      max: 1,
      step: 0.01,
      value: phaseDistortion,
      defaultValue: DEFAULT_PHASE_DISTORTION,
      onChange: onPhaseDistortionChange,
    },
    {
      id: 'generate-fm-amount',
      paramKey: 'fmAmount',
      label: 'FM Amount',
      ariaLabel: 'FM amount',
      min: 0,
      max: 1,
      step: 0.01,
      value: fmAmount,
      defaultValue: DEFAULT_FM_AMOUNT,
      onChange: onFmAmountChange,
    },
    {
      id: 'generate-fm-ratio',
      paramKey: 'fmRatio',
      label: 'FM Ratio',
      ariaLabel: 'FM ratio',
      min: 0.25,
      max: 16,
      step: 0.25,
      value: fmRatio,
      defaultValue: DEFAULT_FM_RATIO,
      onChange: onFmRatioChange,
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
    {
      id: 'generate-fold',
      paramKey: 'fold',
      label: 'Fold',
      ariaLabel: 'Fold',
      min: 0,
      max: 1,
      step: 0.01,
      value: fold,
      defaultValue: DEFAULT_FOLD,
      onChange: onFoldChange,
    },
  ]

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
    const baseFrequency = settings.sampleRate / FRAME_LENGTH
    const targetFrequency = getMidiNoteFrequency(midiNote)
    playbackRef.current.setPlaybackRate(targetFrequency / baseFrequency)
  }, [midiNote, playbackRef, settings.sampleRate])

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
      settings.sampleRate,
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

      output.set(renderAdditiveFrame(params), frameIndex * FRAME_LENGTH)
    }

    return buffer
  }

  async function addToFiles() {
    const outputBuffer = hasActiveSweep ? renderSweepBuffer() : previewBuffer
    const bytes = encodeWav(outputBuffer, settings.bitDepth)
    const defaultName = formatDefaultName(nextFrameNumber, hasActiveSweep)

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
      bitDepth: settings.bitDepth,
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
        <Button type="button" onClick={addToFiles}>
          {hasActiveSweep ? 'Generate' : 'Add to Files'}
        </Button>
      </Toolbar>
      <Body>
        <Controls
          controls={controls}
          sweepLanes={sweepLanes}
          onToggleSweepLane={toggleSweepLane}
          onChangeSweepLane={changeSweepLane}
        />
        <Preview samples={samples} sampleRate={settings.sampleRate} />
      </Body>
    </Container>
  )
}
