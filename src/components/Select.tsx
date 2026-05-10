import styled from '@emotion/styled'

type Override<T, U> = Omit<T, keyof U> & U
type SelectOption = string | number | { label: string; value: string }

type Props = Override<
  React.HTMLAttributes<HTMLSelectElement>,
  {
    value: string
    options: SelectOption[]
    onChange: (value: string) => void
  }
>

const SelectWrapper = styled.span`
  position: relative;
  display: inline-flex;
  width: 100%;

  &::after {
    content: '';
    position: absolute;
    right: 10px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-right: 1px solid currentColor;
    border-bottom: 1px solid currentColor;
    transform: translateY(-60%) rotate(45deg);
    pointer-events: none;
    opacity: 0.7;
  }
`

const StyledSelect = styled.select`
  width: 100%;
  height: 22px;
  margin: 1px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  background: var(--button-bg);
  color: var(--text-color);
  font-size: 10px;
  appearance: none;
`

export default function Select({ value, options, onChange, ...rest }: Props) {
  return (
    <SelectWrapper>
      <StyledSelect
        value={value}
        onChange={(e) => {
          onChange(e.currentTarget.value)
        }}
        {...rest}
      >
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option
          const label = typeof option === 'object' ? option.label : option

          return (
            <option key={value} value={value}>
              {label}
            </option>
          )
        })}
      </StyledSelect>
    </SelectWrapper>
  )
}
