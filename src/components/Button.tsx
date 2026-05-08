import styled from '@emotion/styled'

const Button = styled.button`
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

export default Button
