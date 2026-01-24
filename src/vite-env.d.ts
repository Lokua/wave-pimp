/// <reference types="vite/client" />

declare module '*.svg?react' {
  import { FunctionComponent, SVGProps } from 'react'
  const content: FunctionComponent<SVGProps<SVGSVGElement>>
  export default content
}

interface Window {
  electron: {
    invoke: (channel: string, data?: unknown) => Promise<any>
    on: (
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => void,
    ) => void
    off: (channel: string, listener: (...args: unknown[]) => void) => void
  }
}
