import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { eventChannels } from '@shared/ipc'
import type { MenuCommand } from '@shared/types'
import { logFilePath } from './logger'

/** Menu de aplicativo completo, com os atalhos padrão do Mac (Cmd no macOS, Ctrl nos demais). */
export function buildMenu(getWindow: () => BrowserWindow | null): void {
  const send = (command: MenuCommand) => () => getWindow()?.webContents.send(eventChannels.onMenuCommand, command)
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'Sobre a monia' },
              { type: 'separator' },
              { label: 'Ajustes…', accelerator: 'Cmd+,', click: send('settings') },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar' },
              { role: 'hideOthers', label: 'Ocultar outros' },
              { role: 'unhide', label: 'Mostrar tudo' },
              { type: 'separator' },
              { role: 'quit', label: 'Encerrar' }
            ]
          } satisfies MenuItemConstructorOptions
        ]
      : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Sincronizar…', accelerator: 'CmdOrCtrl+I', click: send('sync') },
        ...(isMac
          ? []
          : ([
              { type: 'separator' },
              { label: 'Configurações…', accelerator: 'Ctrl+,', click: send('settings') },
              { type: 'separator' },
              { role: 'quit', label: 'Sair' }
            ] satisfies MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
        { type: 'separator' },
        { label: 'Buscar', accelerator: 'CmdOrCtrl+F', click: send('search') }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Painel', accelerator: 'CmdOrCtrl+1', click: send('navigate-dashboard') },
        { label: 'Transações', accelerator: 'CmdOrCtrl+2', click: send('navigate-transactions') },
        { label: 'Revisar', accelerator: 'CmdOrCtrl+3', click: send('navigate-review') },
        { label: 'Regras', accelerator: 'CmdOrCtrl+4', click: send('navigate-rules') },
        { type: 'separator' },
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho real' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac ? ([{ type: 'separator' }, { role: 'front', label: 'Trazer tudo para frente' }] satisfies MenuItemConstructorOptions[]) : []),
        { role: 'close', label: 'Fechar' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Mostrar logs',
          click: () => {
            const file = logFilePath()
            if (file) shell.showItemInFolder(file)
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
