import {
  app,
  BrowserWindow,
  crashReporter,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import contextMenu from 'electron-context-menu'
import {
  buildPeaksCache,
  buildPeaksCacheLevel,
  calculateBlockSizes,
} from './peaksBuilder'
import ScopeCapture from './scopeCapture'

app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashes'))

crashReporter.start({
  submitURL: 'https://example.invalid',
  uploadToServer: false,
})

process.on('uncaughtException', (err) => {
  console.error('[main uncaughtException]', err)
})

process.on('unhandledRejection', (err) => {
  console.error('[main unhandledRejection]', err)
})

app.on('render-process-gone', (_e, wc, details) => {
  console.error('[app render-process-gone]', { details, url: wc.getURL() })
})

app.on('child-process-gone', (_e, details) => {
  console.error('[app child-process-gone]', details)
})

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
const scopeCapture = new ScopeCapture()

function sendOpenSettings() {
  const target = BrowserWindow.getFocusedWindow() ?? win
  if (target) {
    target.webContents.send('open-settings')
  }
}

function createAppMenu() {
  const isMac = process.platform === 'darwin'
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Settings...',
        accelerator: 'CmdOrCtrl+,',
        click: sendOpenSettings,
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ] as MenuItemConstructorOptions[],
  }

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'Settings...',
        accelerator: 'CmdOrCtrl+,',
        click: sendOpenSettings,
      },
      { type: 'separator' },
      { role: 'quit' },
    ] as MenuItemConstructorOptions[],
  }

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            { role: 'speech' },
          ]
        : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
    ] as MenuItemConstructorOptions[],
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ] as MenuItemConstructorOptions[],
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [{ type: 'separator' }, { role: 'front' }]
        : [{ role: 'close' }]),
    ] as MenuItemConstructorOptions[],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : [fileMenu]),
    editMenu,
    viewMenu,
    windowMenu,
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function attachWebContentsDeathLogging(win: BrowserWindow) {
  const wc = win.webContents

  wc.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', {
      // "oom" | "crashed" | "killed" | "clean-exit" | ...
      reason: details.reason,
      exitCode: details.exitCode,
    })
  })

  wc.on('unresponsive', () => {
    console.error('[webcontents-unresponsive]')
  })

  wc.on('responsive', () => {
    console.error('[webcontents-responsive-again]')
  })

  wc.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('[did-fail-load]', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      })
    },
  )
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icons/vmc.png'),
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 400,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  attachWebContentsDeathLogging(win)
  win.on('closed', () => {
    void scopeCapture.stop()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle(
  'rename-file',
  async (
    _,
    data: {
      old_name: string
      new_name: string
    },
  ) => {
    try {
      const { old_name, new_name } = data
      const old_path = path.resolve(old_name)
      const dir = path.dirname(old_path)
      const new_path = path.join(dir, new_name)
      await fs.rename(old_path, new_path)
      return { success: true }
    } catch (error) {
      console.error('Failed to rename file:', error)
      throw error
    }
  },
)

function isAppSender(sender: Electron.WebContents) {
  return sender === win?.webContents
}

ipcMain.handle('scope-list-input-devices', (event) => {
  if (!isAppSender(event.sender)) throw new Error('Invalid Scope request.')
  return scopeCapture.listInputDevices()
})

ipcMain.handle(
  'scope-start',
  async (
    event,
    data: {
      deviceId: number
      traces: Array<{ channel: number; enabled: boolean }>
    },
  ) => {
    if (!isAppSender(event.sender)) throw new Error('Invalid Scope request.')
    return scopeCapture.start({
      target: event.sender,
      deviceId: data.deviceId,
      traces: data.traces,
    })
  },
)

ipcMain.handle(
  'scope-set-traces',
  (event, traces: Array<{ channel: number; enabled: boolean }>) => {
    if (!isAppSender(event.sender)) throw new Error('Invalid Scope request.')
    scopeCapture.setTraces(traces)
  },
)

ipcMain.handle('scope-stop', async (event) => {
  if (!isAppSender(event.sender)) throw new Error('Invalid Scope request.')
  await scopeCapture.stop()
})

ipcMain.handle(
  'save-wav',
  async (
    _,
    data: {
      bytes: ArrayBuffer | Uint8Array
      path?: string
      defaultPath?: string
    },
  ) => {
    try {
      const { bytes, path: targetPath, defaultPath } = data
      let savePath = targetPath
      if (!savePath) {
        const result = await dialog.showSaveDialog({
          defaultPath,
          filters: [{ name: 'WAV', extensions: ['wav'] }],
        })
        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }
        savePath = result.filePath
      }

      const buffer = Buffer.from(
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      )
      await fs.writeFile(savePath, buffer)
      return { canceled: false, path: savePath }
    } catch (error) {
      console.error('Failed to save WAV:', error)
      throw error
    }
  },
)

ipcMain.handle(
  'build-peaks-cache',
  async (
    _,
    data: {
      channelData: Float32Array[]
      maxCacheWidth: number
      options: { onlyLowestLevel: boolean }
    },
  ) => {
    try {
      // console.time('[MAIN PROCESS] buildPeaksCache')
      const { channelData, maxCacheWidth, options } = data
      const peaksCache = buildPeaksCache(channelData, maxCacheWidth, options)
      // console.timeEnd('[MAIN PROCESS] buildPeaksCache')
      return { peaksCache }
    } catch (error) {
      console.error('Failed to build peaks cache:', error)
      throw error
    }
  },
)

// Calculate which block sizes will be needed for streaming
ipcMain.handle(
  'calculate-block-sizes',
  async (
    _,
    data: {
      totalSamples: number
      maxCacheWidth: number
    },
  ) => {
    try {
      const { totalSamples, maxCacheWidth } = data
      const blockSizes = calculateBlockSizes(totalSamples, maxCacheWidth)
      return { blockSizes }
    } catch (error) {
      console.error('Failed to calculate block sizes:', error)
      throw error
    }
  },
)

// Build a single cache level and return it
ipcMain.handle(
  'build-peaks-cache-level',
  async (
    _,
    data: {
      channelData: Float32Array[]
      blockSize: number
    },
  ) => {
    try {
      const { channelData, blockSize } = data
      const levels = buildPeaksCacheLevel(channelData, blockSize)
      return { levels }
    } catch (error) {
      console.error('Failed to build peaks cache level:', error)
      throw error
    }
  },
)

contextMenu({
  showLearnSpelling: false,
  showInspectElement: true,
})

app.whenReady().then(() => {
  createWindow()
  createAppMenu()
})
