import Edit from '@material-symbols/svg-400/rounded/edit_audio-fill.svg?react'
import Play from '@material-symbols/svg-400/rounded/play_arrow-fill.svg?react'
import Pause from '@material-symbols/svg-400/rounded/pause-fill.svg?react'
import SelectFromStart from '@material-symbols/svg-400/rounded/text_select_start-fill.svg?react'
import Remove from '@material-symbols/svg-400/rounded/delete-fill.svg?react'
import Save from '@material-symbols/svg-400/rounded/save-fill.svg?react'
import SaveAs from '@material-symbols/svg-400/rounded/save_as-fill.svg?react'
import ZoomIn from '@material-symbols/svg-400/rounded/zoom_in-fill.svg?react'
import ZoomOut from '@material-symbols/svg-400/rounded/zoom_out-fill.svg?react'
import Close from '@material-symbols/svg-400/rounded/close-fill.svg?react'
import Cancel from '@material-symbols/svg-400/rounded/cancel-fill.svg?react'
import SelectToEnd from '@material-symbols/svg-400/rounded/text_select_end-fill.svg?react'
import Crop from '@material-symbols/svg-400/rounded/crop-fill.svg?react'
import Trim from '@material-symbols/svg-400/rounded/content_cut-fill.svg?react'
import Normalize from '@material-symbols/svg-400/rounded/chevron_line_up-fill.svg?react'
import FadeIn from '@material-symbols/svg-400/rounded/arrow_upward-fill.svg?react'
import FadeOut from '@material-symbols/svg-400/rounded/arrow_downward-fill.svg?react'
import ClearAll from '@material-symbols/svg-400/rounded/clear_all-fill.svg?react'
import ZoomFit from '@material-symbols/svg-400/rounded/fit_screen-fill.svg?react'
import Stop from '@material-symbols/svg-400/rounded/stop-fill.svg?react'
import Back from '@material-symbols/svg-400/rounded/arrow_back-fill.svg?react'
import Checklist from '@material-symbols/svg-400/rounded/checklist-fill.svg?react'
import Tune from '@material-symbols/svg-400/rounded/tune-fill.svg?react'
import Join from '@material-symbols/svg-400/rounded/join-fill.svg?react'

import styled from '@emotion/styled'

const icons = {
  Edit,
  Play,
  Pause,
  SelectFromStart,
  Remove,
  Save,
  SaveAs,
  ZoomIn,
  ZoomOut,
  Close,
  Cancel,
  SelectToEnd,
  Crop,
  Trim,
  Normalize,
  FadeIn,
  FadeOut,
  ClearAll,
  ZoomFit,
  Stop,
  Back,
  Checklist,
  Tune,
  Join,
}

type IconName = keyof typeof icons

// eslint-disable-next-line max-len
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName
  on?: boolean
  isToggle?: boolean
}

const IconButtonRoot = styled('button', {
  shouldForwardProp: (prop) => prop !== 'isOn' && prop !== 'isToggle',
})<{ isOn: boolean; isToggle: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 0;
  background: transparent;
  color: inherit;
  line-height: 0;
  cursor: pointer;
  opacity: ${({ isOn, isToggle }) => (isToggle && !isOn ? 0.6 : 1)};

  svg {
    width: 20px;
    height: 20px;
    display: block;
    fill: currentColor;
    pointer-events: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }
`

export default function IconButton({
  name,
  disabled,
  on = false,
  isToggle = false,
  ...rest
}: IconButtonProps) {
  const Icon = icons[name]

  return (
    <IconButtonRoot
      disabled={disabled}
      isOn={on}
      isToggle={isToggle}
      aria-pressed={isToggle ? on : undefined}
      {...rest}
    >
      <Icon aria-hidden="true" focusable="false" />
    </IconButtonRoot>
  )
}
