import styled from '@emotion/styled'

import IconButton from '../components/IconButton'
import { formatDuration, isMac } from '../util'

const Controls = styled.div`
  padding: 0 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

const Section = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  isSidebarVisible: boolean
  onToggleSidebar: () => void
  showSidebarToggle?: boolean
  canZoomIn: boolean
  canZoomOut: boolean
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
  isSidebarVisible,
  onToggleSidebar,
  showSidebarToggle = true,
  canZoomIn,
  canZoomOut,
}: WaveEditorControlsProps) {
  const metaKeyLabel = isMac ? 'Cmd' : 'Ctrl'
  const sidebarShortcutLabel = `${metaKeyLabel}+\\`
  return (
    <Controls>
      {showSidebarToggle ? (
        <>
          <Section>
            <IconButton
              type="button"
              name="Back"
              aria-label={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
              title={`${isSidebarVisible ? 'Hide' : 'Show'} sidebar (${sidebarShortcutLabel})`}
              onClick={onToggleSidebar}
              on={isSidebarVisible}
              isToggle
              style={
                isSidebarVisible
                  ? undefined
                  : {
                      transform: 'scaleX(-1)',
                    }
              }
            />
          </Section>
          <Divider />
        </>
      ) : null}
      <Section>
        <IconButton
          type="button"
          name="Play"
          aria-label="Play"
          title="Play (Space)"
          onClick={onClickPlay}
        />
        <IconButton
          type="button"
          name={isPlaying ? 'Pause' : 'Stop'}
          aria-label={isPlaying ? 'Pause' : 'Stop'}
          title={`${isPlaying ? 'Pause' : 'Stop'} (Space)`}
          onClick={onClickStop}
        />
        <TimeDisplay>
          {formatDuration(elapsedSeconds)}/{formatDuration(durationSeconds)}
        </TimeDisplay>
      </Section>
      <Divider />
      <Section>
        <IconButton
          type="button"
          name="ZoomIn"
          aria-label="Zoom in"
          title="Zoom in (])"
          onClick={onClickZoomIn}
          disabled={!canZoomIn}
        />
        <IconButton
          type="button"
          name="ZoomOut"
          aria-label="Zoom out"
          title="Zoom out ([)"
          onClick={onClickZoomOut}
          disabled={!canZoomOut}
        />
        <IconButton
          type="button"
          name="ZoomFit"
          aria-label="Zoom to fit"
          title="Zoom to fit"
          onClick={onClickZoomFit}
        />
      </Section>
      <Divider />
      <Section>
        <IconButton
          type="button"
          name="SelectFromStart"
          aria-label="Select From Start"
          title={`Select from start (${metaKeyLabel}+Left)`}
          onClick={onClickSelectToStart}
        />
        <IconButton
          type="button"
          name="SelectToEnd"
          aria-label="Select To End"
          title={`Select to end (${metaKeyLabel}+Right)`}
          onClick={onClickSelectToEnd}
        />
      </Section>
      <Divider />
      <Section>
        <IconButton
          type="button"
          name="Crop"
          aria-label="Crop"
          title="Crop (K)"
          onClick={onClickCrop}
        />
        <IconButton
          type="button"
          name="Trim"
          aria-label="Trim"
          title="Trim (X)"
          onClick={onClickTrim}
        />
        <IconButton
          type="button"
          name="FadeIn"
          aria-label="Fade in"
          title="Fade in (F)"
          onClick={onClickFadeIn}
        />
        <IconButton
          type="button"
          name="FadeOut"
          aria-label="Fade out"
          title="Fade out (V)"
          onClick={onClickFadeOut}
        />
        <IconButton
          type="button"
          name="Normalize"
          aria-label="Normalize"
          title="Normalize (N)"
          onClick={onClickNormalize}
        />
      </Section>
      <Divider />
      <Section>
        <IconButton
          type="button"
          name="Save"
          aria-label="Save"
          title={`Save (${metaKeyLabel}+S)`}
          onClick={onClickSave}
        />
        <IconButton
          type="button"
          name="SaveAs"
          aria-label="Save As"
          title={`Save As (${metaKeyLabel}+Shift+S)`}
          onClick={onClickSaveAs}
        />
      </Section>
    </Controls>
  )
}
