import styled from '@emotion/styled'
import NumberBox from '@lokua/number-box'

import IconButton from '../components/IconButton'

const ControlsPane = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--border-color);
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

export type GeneratorControlValue = {
  id: string
  label: string
  ariaLabel: string
  min: number
  max: number
  step: number
  value: number
  defaultValue: number
  onChange: (value: number) => void
}

type ControlsProps = {
  controls: GeneratorControlValue[]
}

export default function Controls({ controls }: ControlsProps) {
  return (
    <ControlsPane>
      {controls.map((control) => (
        <ControlGroup key={control.id}>
          <Label htmlFor={control.id}>{control.label}</Label>
          <ControlInputs>
            <Range
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={(event) =>
                control.onChange(Number(event.target.value))
              }
            />
            <StyledNumberBox
              id={control.id}
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={control.onChange}
              aria-label={control.ariaLabel}
            />
            <IconButton
              type="button"
              name="Refresh"
              muted
              aria-label={`Reset ${control.ariaLabel.toLowerCase()}`}
              title={`Reset ${control.ariaLabel.toLowerCase()}`}
              onClick={() => control.onChange(control.defaultValue)}
            />
          </ControlInputs>
        </ControlGroup>
      ))}
    </ControlsPane>
  )
}
