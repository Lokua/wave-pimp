import { createContext, useCallback, useMemo, useState } from 'react'

export type PlaybackContextValue = {
  isLooping: boolean
  toggleLoop: () => void
  setLooping: (next: boolean) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const PlaybackContext = createContext<PlaybackContextValue | null>(null)

type PlaybackProviderProps = {
  children: React.ReactNode
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const [isLooping, setIsLooping] = useState(false)

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      return !prev
    })
  }, [])

  const setLooping = useCallback((next: boolean) => {
    setIsLooping(next)
  }, [])

  const value = useMemo(() => {
    return {
      isLooping,
      toggleLoop,
      setLooping,
    }
  }, [isLooping, toggleLoop, setLooping])

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  )
}
