import styled from '@emotion/styled'

import FieldLabel from '../components/FieldLabel'
import IconButton from '../components/IconButton'
import NumberBox from '../components/NumberBox'
import Range from '../components/Range'
import type { AdditiveFrameParams } from './synthesis'

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
  grid-template-columns: minmax(0, 1fr) 58px 24px 24px;
  align-items: center;
  gap: 6px;
`

const SweepInputs = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 20px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding-left: 8px;
`

const SweepLabel = styled(FieldLabel)`
  opacity: 0.72;
`

export type GeneratorControlValue = {
  id: string
  paramKey: keyof AdditiveFrameParams
  label: string
  ariaLabel: string
  min: number
  max: number
  step: number
  isInteger?: boolean
  value: number
  defaultValue: number
  onChange: (value: number) => void
}

export type SweepLaneValue = {
  enabled: boolean
  from: number
  to: number
}

type ControlsProps = {
  controls: GeneratorControlValue[]
  sweepLanes: Partial<Record<keyof AdditiveFrameParams, SweepLaneValue>>
  onToggleSweepLane: (control: GeneratorControlValue) => void
  onChangeSweepLane: (
    control: GeneratorControlValue,
    field: 'from' | 'to',
    value: number,
  ) => void
}

export default function Controls({
  controls,
  sweepLanes,
  onToggleSweepLane,
  onChangeSweepLane,
}: ControlsProps) {
  return (
    <ControlsPane>
      {controls.map((control) => {
        const sweepLane = sweepLanes[control.paramKey]
        const isSweeping = sweepLane?.enabled ?? false

        return (
          <ControlGroup key={control.id}>
            <FieldLabel htmlFor={control.id}>{control.label}</FieldLabel>
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
              <NumberBox
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
              <IconButton
                type="button"
                name="Tune"
                isToggle
                on={isSweeping}
                aria-label={`${isSweeping ? 'Disable' : 'Enable'} ${control.ariaLabel.toLowerCase()} sweep`}
                title={`${isSweeping ? 'Disable' : 'Enable'} ${control.ariaLabel.toLowerCase()} sweep`}
                onClick={() => onToggleSweepLane(control)}
              />
            </ControlInputs>
            {isSweeping && sweepLane ? (
              <SweepInputs>
                <SweepLabel htmlFor={`${control.id}-sweep-from`}>
                  From
                </SweepLabel>
                <NumberBox
                  id={`${control.id}-sweep-from`}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={sweepLane.from}
                  onChange={(value) =>
                    onChangeSweepLane(control, 'from', value)
                  }
                  aria-label={`${control.ariaLabel} sweep from`}
                />
                <SweepLabel htmlFor={`${control.id}-sweep-to`}>To</SweepLabel>
                <NumberBox
                  id={`${control.id}-sweep-to`}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={sweepLane.to}
                  onChange={(value) => onChangeSweepLane(control, 'to', value)}
                  aria-label={`${control.ariaLabel} sweep to`}
                />
              </SweepInputs>
            ) : null}
          </ControlGroup>
        )
      })}
    </ControlsPane>
  )
}
