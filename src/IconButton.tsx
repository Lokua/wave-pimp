import Edit from '@material-symbols/svg-400/rounded/edit-fill.svg?react'
import Play from '@material-symbols/svg-400/rounded/play_arrow-fill.svg?react'
import Pause from '@material-symbols/svg-400/rounded/pause-fill.svg?react'
import Restart from '@material-symbols/svg-400/rounded/skip_previous-fill.svg?react'
import Remove from '@material-symbols/svg-400/rounded/delete-fill.svg?react'
import Save from '@material-symbols/svg-400/rounded/save-fill.svg?react'
import ZoomIn from '@material-symbols/svg-400/rounded/zoom_in-fill.svg?react'
import ZoomOut from '@material-symbols/svg-400/rounded/zoom_out-fill.svg?react'
import Close from '@material-symbols/svg-400/rounded/close-fill.svg?react'
import Cancel from '@material-symbols/svg-400/rounded/cancel-fill.svg?react'
import Forward from '@material-symbols/svg-400/rounded/skip_next-fill.svg?react'
import Crop from '@material-symbols/svg-400/rounded/crop-fill.svg?react'
import ContentCut from '@material-symbols/svg-400/rounded/content_cut-fill.svg?react'
import Tune from '@material-symbols/svg-400/rounded/tune-fill.svg?react'
import FadeIn from '@material-symbols/svg-400/rounded/arrow_upward-fill.svg?react'
import FadeOut from '@material-symbols/svg-400/rounded/arrow_downward-fill.svg?react'
import ClearAll from '@material-symbols/svg-400/rounded/clear_all-fill.svg?react'
import Fit from '@material-symbols/svg-400/rounded/fit_screen-fill.svg?react'

function clsx(...args: (string | boolean | undefined | null)[]) {
  return args.filter(Boolean).join(' ')
}

const icons = {
  Edit,
  Play,
  Pause,
  Restart,
  Remove,
  Save,
  ZoomIn,
  ZoomOut,
  Close,
  Cancel,
  Forward,
  Crop,
  ContentCut,
  Tune,
  FadeIn,
  FadeOut,
  ClearAll,
  Fit,
}

type IconName = keyof typeof icons

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName
  on?: boolean
  isToggle?: boolean
}

export default function IconButton({
  name,
  className,
  disabled,
  on = false,
  isToggle = false,
  ...rest
}: IconButtonProps) {
  const Icon = icons[name]

  return (
    <button
      className={clsx(
        'icon-button',
        on && !disabled && 'on',
        `${name}-icon`,
        className,
        isToggle && 'toggle',
      )}
      disabled={disabled}
      {...rest}
    >
      <Icon />
    </button>
  )
}
