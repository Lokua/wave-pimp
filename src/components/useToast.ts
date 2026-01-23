import { useEffect, useRef, useState } from 'react'

export default function useToast(durationMs = 2000) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  function showToast(nextMessage: string) {
    setMessage(nextMessage)
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      setMessage(null)
    }, durationMs)
  }

  return { message, showToast }
}
