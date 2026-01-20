import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
    )
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, data?: unknown) =>
    ipcRenderer.invoke(channel, data),
  on: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => void,
  ) => ipcRenderer.on(channel, listener),
  off: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.off(channel, listener),
})
