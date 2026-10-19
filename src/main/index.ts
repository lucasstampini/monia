import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell, systemPreferences, type BrowserWindowConstructorOptions } from 'electron'
import { eventChannels } from '@shared/ipc'
import { openDatabase } from './db/client'
import { registerIpcHandlers } from './ipc/handlers'
import { buildMenu } from './menu'

let mainWindow: BrowserWindow | null = null

/** Cor de destaque do sistema; fallback para o systemBlue claro/escuro. */
function accentColor(): string {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const rgba = systemPreferences.getAccentColor() // "RRGGBBAA"
      if (/^[0-9a-f]{8}$/i.test(rgba)) return `#${rgba.slice(0, 6)}`
    } catch {
      // segue para o fallback
    }
  }
  return nativeTheme.shouldUseDarkColors ? '#0A84FF' : '#007AFF'
}

/** Material da janela por plataforma: vidro no macOS, Mica no Windows, sólido no Linux. */
function platformWindowOptions(): BrowserWindowConstructorOptions {
  switch (process.platform) {
    case 'darwin':
      return {
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 18, y: 18 },
        vibrancy: 'sidebar',
        visualEffectState: 'followWindow',
        backgroundColor: '#00000000'
      }
    case 'win32':
      return {
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000', height: 52 },
        backgroundMaterial: 'mica',
        backgroundColor: '#00000000'
      }
    default:
      return { backgroundColor: nativeTheme.shouldUseDarkColors ? '#1E1E1E' : '#ECECEC' }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    show: false,
    title: 'Análise de Gastos',
    ...platformWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Links externos abrem no navegador; a janela nunca navega para fora do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcastAppearance(): void {
  mainWindow?.webContents.send(eventChannels.onAccentChange, accentColor())
  if (process.platform === 'win32') {
    mainWindow?.setTitleBarOverlay({ symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000' })
  }
}

app.whenReady().then(() => {
  const db = openDatabase(join(app.getPath('userData'), 'financas.db'), join(app.getAppPath(), 'drizzle'))
  const getWindow = () => mainWindow

  registerIpcHandlers(db, getWindow, accentColor)
  buildMenu(getWindow)
  createWindow()

  nativeTheme.on('updated', broadcastAppearance)
  if (process.platform === 'win32') systemPreferences.on('accent-color-changed', broadcastAppearance)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
