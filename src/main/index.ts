import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell, type BrowserWindowConstructorOptions } from 'electron'
import { openDatabase } from './db/client'
import { registerIpcHandlers } from './ipc/handlers'
import { createLogger, initLogger } from './logger'
import { buildMenu } from './menu'

let mainWindow: BrowserWindow | null = null

// A pasta de dados (banco, segredos, logs) fica fixa, independente do nome do app.
// O app passou a se chamar "monia"; sem isso, o executável empacotado procuraria
// os dados em outra pasta e abriria vazio. `--user-data-dir` continua valendo (testes isolados).
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'analise-de-gastos'))
}

/** Ícone da monia (Windows e Linux; no macOS o ícone vem do pacote .app). */
const APP_ICON = join(app.getAppPath(), 'resources', 'icon.png')

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
    title: 'monia',
    icon: process.platform === 'darwin' ? undefined : APP_ICON,
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

/** No Windows, os botões nativos da janela acompanham o tema claro/escuro. */
function updateTitleBarOverlay(): void {
  if (process.platform === 'win32') {
    mainWindow?.setTitleBarOverlay({ symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000' })
  }
}

const log = createLogger('app')

process.on('uncaughtException', (error) => log.error('erro não tratado', { error: error.stack ?? error.message }))
process.on('unhandledRejection', (reason) => log.error('promise rejeitada', { error: String(reason) }))

app.whenReady().then(() => {
  const logFile = initLogger(app.getPath('logs'))
  log.info('app iniciado', { version: app.getVersion(), electron: process.versions.electron, platform: process.platform, logFile })

  const db = openDatabase(join(app.getPath('userData'), 'financas.db'), join(app.getAppPath(), 'drizzle'))
  const getWindow = () => mainWindow

  registerIpcHandlers(db, getWindow)
  buildMenu(getWindow)
  createWindow()

  nativeTheme.on('updated', updateTitleBarOverlay)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
