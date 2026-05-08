import styled from '@emotion/styled'

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

  &:disabled {
    cursor: not-allowed;
  }

  &:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }
`

export default Range
