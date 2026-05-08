import styled from '@emotion/styled'
import NumberBox from '@lokua/number-box'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AudioFile, Settings } from './types'
import IconButton from './components/IconButton'
import { encodeWav } from './export'
import useAudioPlayback from './useAudioPlayback'
import useElementSize from './useElementSize'

const FRAME_LENGTH = 2048
const DEFAULT_MIDI_NOTE = 36
const DEFAULT_HARMONIC_COUNT = 1
const DEFAULT_ROLLOFF = 1
const DEFAULT_ODD_EVEN_BALANCE = 0
const DEFAULT_PHASE_DISTORTION = 0
const DEFAULT_FM_AMOUNT = 0
const DEFAULT_FM_RATIO = 1
const DEFAULT_DRIVE = 0
const DEFAULT_FOLD = 0

const MIDI_NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
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

const ControlsPane = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--border-color);
`

const PreviewPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  gap: 12px;
`

const ControlGroup = styled.fieldset`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  width: 100%;
  margin: 0 0 14px;
  padding: 0;
  border: 0;
`

const ControlInputs = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px 24px;
  align-items: center;
  gap: 6px;
`

const Label = styled.label`
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  color: var(--text-color);
`

const StyledNumberBox = styled(NumberBox)`
  width: 58px;
  height: 22px;
  margin: 1px;
  min-width: 0;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  background: var(--button-bg);
  color: var(--text-color);
  font-size: 10px;
  text-align: right;

  &:focus {
    outline: none;
  }

  &:hover {
    border-color: var(--text-color);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--text-color);
  }
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

const CanvasWrap = styled.div`
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-canvas);
  background: var(--bg-canvas);
`

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`

const InfoPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  flex-shrink: 0;
  gap: 8px 12px;
  padding: 0 4px;
`

const InfoItem = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;

  &:not(:last-child)::after {
    content: ' ';
    margin-left: 6px;
    opacity: 0.6;
  }
`

const InfoLabel = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
`

const InfoValue = styled.span`
  font-size: 12px;
`

type GenerateViewProps = {
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

function removeDcAndNormalize(samples: Float32Array) {
  let mean = 0
  for (const sample of samples) {
    mean += sample
  }
  mean /= samples.length

  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    samples[i] -= mean
    peak = Math.max(peak, Math.abs(samples[i]))
  }

  if (peak === 0) return
  for (let i = 0; i < samples.length; i++) {
    samples[i] /= peak
  }
}

function getOddEvenGain(harmonic: number, balance: number) {
  const isOdd = harmonic % 2 === 1
  if (isOdd) return balance > 0 ? 1 - balance : 1
  return balance < 0 ? 1 + balance : 1
}

function distortPhase(phase: number, amount: number) {
  if (amount === 0) return phase

  if (amount > 0) {
    return phase ** (1 + amount * 4)
  }

  return 1 - (1 - phase) ** (1 + -amount * 4)
}

function modulatePhase(phase: number, amount: number, ratio: number) {
  if (amount === 0) return phase

  return phase + amount * 0.25 * Math.sin(Math.PI * 2 * phase * ratio)
}

function foldSample(sample: number, amount: number) {
  if (amount === 0) return sample

  const drive = 1 + amount * 8
  let folded = sample * drive

  while (folded > 1 || folded < -1) {
    if (folded > 1) {
      folded = 2 - folded
    } else if (folded < -1) {
      folded = -2 - folded
    }
  }

  return folded
}

function saturateSample(sample: number, amount: number) {
  if (amount === 0) return sample

  const drive = 1 + amount * 24
  return Math.tanh(sample * drive) / Math.tanh(drive)
}

function renderAdditiveFrame({
  harmonicCount,
  rolloff,
  oddEvenBalance,
  phaseDistortion,
  fmAmount,
  fmRatio,
  drive,
  fold,
}: {
  harmonicCount: number
  rolloff: number
  oddEvenBalance: number
  phaseDistortion: number
  fmAmount: number
  fmRatio: number
  drive: number
  fold: number
}) {
  const samples = new Float32Array(FRAME_LENGTH)

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const phase = modulatePhase(
      distortPhase(i / FRAME_LENGTH, phaseDistortion),
      fmAmount,
      fmRatio,
    )
    let value = 0

    for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      const gain =
        Math.pow(harmonic, -rolloff) *
        getOddEvenGain(harmonic, oddEvenBalance)
      value +=
        gain *
        Math.sin(Math.PI * 2 * harmonic * phase)
    }

    samples[i] = value
  }

  removeDcAndNormalize(samples)
  if (drive > 0) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = saturateSample(samples[i], drive)
    }
    removeDcAndNormalize(samples)
  }

  if (fold > 0) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = foldSample(samples[i], fold)
    }
    removeDcAndNormalize(samples)
  }

  return samples
}

function formatDefaultName(frameNumber: number) {
  return `frame-${String(frameNumber).padStart(3, '0')}.wav`
}

function getMidiNoteLabel(note: number) {
  const name = MIDI_NOTE_NAMES[note % MIDI_NOTE_NAMES.length]
  const octave = Math.floor(note / MIDI_NOTE_NAMES.length) - 1
  return `${name}${octave}`
}

function getMidiNoteFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

function formatMidiNoteDisplay(note: number) {
  return `${note} ${getMidiNoteLabel(note)} ${getMidiNoteFrequency(note).toFixed(2)} Hz`
}

export default function GenerateView({
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
}: GenerateViewProps) {
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [midiNote, setMidiNote] = useState(DEFAULT_MIDI_NOTE)
  const { width, height } = useElementSize(canvasWrapRef)
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--zero-line-color')
      .trim()
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--waveform-color')
      .trim()
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const index = Math.min(
        FRAME_LENGTH - 1,
        Math.floor((x / Math.max(1, width - 1)) * FRAME_LENGTH),
      )
      const y = height / 2 - samples[index] * (height * 0.48)
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }, [height, samples, width])

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
        <ControlsPane>
          <ControlGroup>
            <Label htmlFor="generate-harmonics">Harmonics</Label>
            <ControlInputs>
              <Range
                type="range"
                min={1}
                max={64}
                step={1}
                value={harmonicCount}
                onChange={(event) =>
                  onHarmonicCountChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-harmonics"
                min={1}
                max={64}
                step={1}
                value={harmonicCount}
                onChange={onHarmonicCountChange}
                aria-label="Harmonics"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset harmonics"
                title="Reset harmonics"
                onClick={() => onHarmonicCountChange(DEFAULT_HARMONIC_COUNT)}
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-rolloff">Rolloff</Label>
            <ControlInputs>
              <Range
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={rolloff}
                onChange={(event) =>
                  onRolloffChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-rolloff"
                min={0}
                max={3}
                step={0.05}
                value={rolloff}
                onChange={onRolloffChange}
                aria-label="Rolloff"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset rolloff"
                title="Reset rolloff"
                onClick={() => onRolloffChange(DEFAULT_ROLLOFF)}
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-odd-even">Odd/Even</Label>
            <ControlInputs>
              <Range
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={oddEvenBalance}
                onChange={(event) =>
                  onOddEvenBalanceChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-odd-even"
                min={-1}
                max={1}
                step={0.05}
                value={oddEvenBalance}
                onChange={onOddEvenBalanceChange}
                aria-label="Odd/even balance"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset odd/even balance"
                title="Reset odd/even balance"
                onClick={() =>
                  onOddEvenBalanceChange(DEFAULT_ODD_EVEN_BALANCE)
                }
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-phase-distortion">Phase Distortion</Label>
            <ControlInputs>
              <Range
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={phaseDistortion}
                onChange={(event) =>
                  onPhaseDistortionChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-phase-distortion"
                min={-1}
                max={1}
                step={0.01}
                value={phaseDistortion}
                onChange={onPhaseDistortionChange}
                aria-label="Phase distortion"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset phase distortion"
                title="Reset phase distortion"
                onClick={() =>
                  onPhaseDistortionChange(DEFAULT_PHASE_DISTORTION)
                }
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-fm-amount">FM Amount</Label>
            <ControlInputs>
              <Range
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={fmAmount}
                onChange={(event) =>
                  onFmAmountChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-fm-amount"
                min={0}
                max={1}
                step={0.01}
                value={fmAmount}
                onChange={onFmAmountChange}
                aria-label="FM amount"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset FM amount"
                title="Reset FM amount"
                onClick={() => onFmAmountChange(DEFAULT_FM_AMOUNT)}
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-fm-ratio">FM Ratio</Label>
            <ControlInputs>
              <Range
                type="range"
                min={0.25}
                max={16}
                step={0.25}
                value={fmRatio}
                onChange={(event) =>
                  onFmRatioChange(Number(event.target.value))
                }
              />
              <StyledNumberBox
                id="generate-fm-ratio"
                min={0.25}
                max={16}
                step={0.25}
                value={fmRatio}
                onChange={onFmRatioChange}
                aria-label="FM ratio"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset FM ratio"
                title="Reset FM ratio"
                onClick={() => onFmRatioChange(DEFAULT_FM_RATIO)}
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-drive">Drive</Label>
            <ControlInputs>
              <Range
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={drive}
                onChange={(event) => onDriveChange(Number(event.target.value))}
              />
              <StyledNumberBox
                id="generate-drive"
                min={0}
                max={1}
                step={0.01}
                value={drive}
                onChange={onDriveChange}
                aria-label="Drive"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset drive"
                title="Reset drive"
                onClick={() => onDriveChange(DEFAULT_DRIVE)}
              />
            </ControlInputs>
          </ControlGroup>
          <ControlGroup>
            <Label htmlFor="generate-fold">Fold</Label>
            <ControlInputs>
              <Range
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={fold}
                onChange={(event) => onFoldChange(Number(event.target.value))}
              />
              <StyledNumberBox
                id="generate-fold"
                min={0}
                max={1}
                step={0.01}
                value={fold}
                onChange={onFoldChange}
                aria-label="Fold"
              />
              <IconButton
                type="button"
                name="Refresh"
                muted
                aria-label="Reset fold"
                title="Reset fold"
                onClick={() => onFoldChange(DEFAULT_FOLD)}
              />
            </ControlInputs>
          </ControlGroup>
        </ControlsPane>
        <PreviewPane>
          <CanvasWrap ref={canvasWrapRef}>
            <Canvas ref={canvasRef} aria-label="Generated waveform preview" />
          </CanvasWrap>
          <InfoPanel>
            <InfoItem>
              <InfoLabel>Samples:</InfoLabel>
              <InfoValue>{FRAME_LENGTH.toLocaleString()}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Duration:</InfoLabel>
              <InfoValue>
                {((FRAME_LENGTH / settings.sampleRate) * 1000).toFixed(2)} ms
              </InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Sample Rate:</InfoLabel>
              <InfoValue>{settings.sampleRate.toLocaleString()} Hz</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Channels:</InfoLabel>
              <InfoValue>1</InfoValue>
            </InfoItem>
          </InfoPanel>
        </PreviewPane>
      </Body>
    </Container>
  )
}
