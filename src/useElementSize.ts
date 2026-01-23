import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

type Size = {
  width: number
  height: number
}

export default function useElementSize<T extends HTMLElement>(
  ref: RefObject<T>,
): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      })
    }

    update()

    const observer = new ResizeObserver(() => {
      update()
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [ref])

  return size
}
