import styled from '@emotion/styled'
import BaseNumberBox from '@lokua/number-box'

const NumberBox = styled(BaseNumberBox)`
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

export default NumberBox
