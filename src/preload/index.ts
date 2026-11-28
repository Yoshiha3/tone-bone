import { contextBridge, ipcRenderer } from 'electron'
import { createIpcPlatformBridge } from '@platform/ipcContract'

const bridge = createIpcPlatformBridge((channel, ...args) => ipcRenderer.invoke(channel, ...args))

contextBridge.exposeInMainWorld('onkai', bridge)
