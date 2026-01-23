import styled from '@emotion/styled'
const ToastRoot = styled.div`
  position: fixed;
  right: 20px;
  top: 20px;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--bg-controls);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 13px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 20;
`

type ToastProps = {
  message: string | null
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <ToastRoot role="status" aria-live="polite">
      {message}
    </ToastRoot>
  )
}
