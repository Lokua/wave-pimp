import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'

import IconButton from '../components/IconButton'
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
  FRAME_LENGTH,
} from './constants'
import { formatMidiNoteDisplay, getMidiNoteFrequency } from './midi'
import { renderAdditiveFrame } from './synthesis'

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

const Range = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  min-width: 0;
  height: 4px;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: var(--border-color);
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 50%;
    background: var(--slider-thumb-color);
    cursor: pointer;
  }

  &:active::-webkit-slider-thumb {
    background: var(--text-color);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--text-color);
  }
`

const AddButton = styled.button`
  height: 22px;
  margin: 1px;
  padding: 0 10px;
  border: 1px solid var(--text-color);
  background: var(--button-bg);
  color: var(--text-color);
  font-size: 10px;

  &:focus {
    outline: none;
  }

  &:hover {
    border-color: var(--text-color);
    background: var(--button-active);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--text-color);
  }
`

function formatDefaultName(frameNumber: number) {
  return `frame-${String(frameNumber).padStart(3, '0')}.wav`
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
  const midiNoteLabel = formatMidiNoteDisplay(midiNote)

  const samples = useMemo(
    () =>
      renderAdditiveFrame({
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
      label: 'Harmonics',
      ariaLabel: 'Harmonics',
      min: 1,
      max: 64,
      step: 1,
      value: harmonicCount,
      defaultValue: DEFAULT_HARMONIC_COUNT,
      onChange: onHarmonicCountChange,
    },
    {
      id: 'generate-rolloff',
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

  async function addToFiles() {
    const bytes = encodeWav(previewBuffer, settings.bitDepth)

    const result = (await window.electron.invoke('save-wav', {
      bytes,
      defaultPath: formatDefaultName(nextFrameNumber),
    })) as { canceled: boolean; path?: string }

    if (result.canceled || !result.path) return

    const name =
      result.path.split(/[\\/]/).pop() ?? formatDefaultName(nextFrameNumber)

    onAddFile({
      id: crypto.randomUUID(),
      name,
      filePath: result.path,
      size: bytes.byteLength,
      type: 'audio/wav',
      duration: previewBuffer.duration,
      sampleRate: previewBuffer.sampleRate,
      bitDepth: settings.bitDepth,
      channels: 1,
      sampleCount: FRAME_LENGTH,
      audioBuffer: previewBuffer,
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
        <AddButton type="button" onClick={addToFiles}>
          Add to Files
        </AddButton>
      </Toolbar>
      <Body>
        <Controls controls={controls} />
        <Preview samples={samples} sampleRate={settings.sampleRate} />
      </Body>
    </Container>
  )
}
