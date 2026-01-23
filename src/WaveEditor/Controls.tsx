import styled from '@emotion/styled'

import IconButton from '../components/IconButton'
import { formatDuration } from '../util'

const Controls = styled.div`
  padding: 0 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`

const Divider = styled.span`
  width: 1px;
  height: 20px;
  background: var(--separator-color);
  margin: 0 8px;
`

const TimeDisplay = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  opacity: 0.7;
  min-width: 72px;
  text-align: right;
`

type WaveEditorControlsProps = {
  isPlaying: boolean
  elapsedSeconds: number
  durationSeconds: number
  onClickPlay: () => void
  onClickStop: () => void
  onClickZoomIn: () => void
  onClickZoomOut: () => void
  onClickZoomFit: () => void
  onClickSelectToStart: () => void
  onClickSelectToEnd: () => void
  onClickCrop: () => void
  onClickTrim: () => void
  onClickFadeIn: () => void
  onClickFadeOut: () => void
  onClickNormalize: () => void
  onClickSave: () => void
  onClickSaveAs: () => void
  onBack: () => void
}

export default function WaveEditorControls({
  isPlaying,
  elapsedSeconds,
  durationSeconds,
  onClickPlay,
  onClickStop,
  onClickZoomIn,
  onClickZoomOut,
  onClickZoomFit,
  onClickSelectToStart,
  onClickSelectToEnd,
  onClickCrop,
  onClickTrim,
  onClickFadeIn,
  onClickFadeOut,
  onClickNormalize,
  onClickSave,
  onClickSaveAs,
  onBack,
}: WaveEditorControlsProps) {
  return (
    <Controls>
      <IconButton
        type="button"
        name="Play"
        aria-label="Play"
        title="Play"
        onClick={onClickPlay}
      />
      <IconButton
        type="button"
        name={isPlaying ? 'Pause' : 'Stop'}
        aria-label={isPlaying ? 'Pause' : 'Stop'}
        title={isPlaying ? 'Pause' : 'Stop'}
        onClick={onClickStop}
      />
      <TimeDisplay>
        {formatDuration(elapsedSeconds)}/{formatDuration(durationSeconds)}
      </TimeDisplay>
      <Divider />
      <IconButton
        type="button"
        name="ZoomIn"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={onClickZoomIn}
      />
      <IconButton
        type="button"
        name="ZoomOut"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={onClickZoomOut}
      />
      <IconButton
        type="button"
        name="ZoomFit"
        aria-label="Zoom to fit"
        title="Zoom to fit"
        onClick={onClickZoomFit}
      />
      <Divider />
      <IconButton
        type="button"
        name="SelectFromStart"
        aria-label="Select From Start"
        title="Select from start"
        onClick={onClickSelectToStart}
      />
      <IconButton
        type="button"
        name="SelectToEnd"
        aria-label="Select To End"
        title="Select to end"
        onClick={onClickSelectToEnd}
      />
      <Divider />
      <IconButton
        type="button"
        name="Crop"
        aria-label="Crop"
        title="Crop"
        onClick={onClickCrop}
      />
      <IconButton
        type="button"
        name="Trim"
        aria-label="Trim"
        title="Trim"
        onClick={onClickTrim}
      />
      <IconButton
        type="button"
        name="FadeIn"
        aria-label="Fade in"
        title="Fade in"
        onClick={onClickFadeIn}
      />
      <IconButton
        type="button"
        name="FadeOut"
        aria-label="Fade out"
        title="Fade out"
        onClick={onClickFadeOut}
      />
      <IconButton
        type="button"
        name="Normalize"
        aria-label="Normalize"
        title="Normalize"
        onClick={onClickNormalize}
      />
      <Divider />
      <IconButton
        type="button"
        name="Save"
        aria-label="Save"
        title="Save"
        onClick={onClickSave}
      />
      <IconButton
        type="button"
        name="SaveAs"
        aria-label="Save As"
        title="Save As"
        onClick={onClickSaveAs}
      />
      <IconButton
        type="button"
        name="Back"
        aria-label="Back"
        title="Back to list (Esc)"
        onClick={onBack}
        style={{ marginLeft: 'auto' }}
      />
    </Controls>
  )
}
