import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { eventChannels, invokeChannels, type Api, type EventApi, type InvokeApi } from '@shared/ipc'

// Ponte única entre renderer e main. O renderer nunca vê ipcRenderer, Node ou segredos.

const invokeApi = Object.fromEntries(
  invokeChannels.map((channel) => [channel, (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)])
) as unknown as InvokeApi

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const eventApi: EventApi = {
  onMenuCommand: (callback) => subscribe(eventChannels.onMenuCommand, callback),
  onSyncProgress: (callback) => subscribe(eventChannels.onSyncProgress, callback),
  onAccentChange: (callback) => subscribe(eventChannels.onAccentChange, callback)
}

const api: Api = { ...invokeApi, ...eventApi }

contextBridge.exposeInMainWorld('api', api)
