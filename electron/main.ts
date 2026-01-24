import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import contextMenu from 'electron-context-menu'
import { buildPeaksCache } from './peaksBuilder'

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
      console.time('[MAIN PROCESS] buildPeaksCache')
      const { channelData, maxCacheWidth, options } = data
      const peaksCache = buildPeaksCache(channelData, maxCacheWidth, options)
      console.timeEnd('[MAIN PROCESS] buildPeaksCache')
      return { peaksCache }
    } catch (error) {
      console.error('Failed to build peaks cache:', error)
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
