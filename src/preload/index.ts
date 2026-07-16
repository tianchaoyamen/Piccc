import { contextBridge, ipcRenderer } from 'electron'

// ─── API Definition ───────────────────────────────────────────────────────────

const api = {
  project: {
    new: (): Promise<{ success: boolean }> => ipcRenderer.invoke('project:new'),

    open: (): Promise<{
      success: boolean
      filePath?: string
      data?: string
      canceled?: boolean
      error?: string
    }> => ipcRenderer.invoke('project:open'),

    save: (
      filePath: string,
      data: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('project:save', { filePath, data }),

    saveAs: (
      data: string
    ): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('project:save-as', { data })
  },

  r: {
    detect: (): Promise<{ found: boolean; path: string; version: string }> =>
      ipcRenderer.invoke('r:detect'),

    execute: (
      code: string,
      width: number,
      height: number,
      dpi: number
    ): Promise<{ success: boolean; dataUrl?: string; error?: string }> =>
      ipcRenderer.invoke('r:execute', { code, width, height, dpi }),

    setCustomPath: (path: string | null): Promise<{ found: boolean; path: string; version: string }> =>
      ipcRenderer.invoke('r:setCustomPath', { path }),

    selectExecutable: (): Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('r:selectExecutable')
  },

  image: {
    import: (): Promise<{
      success: boolean
      paths?: string[]
      canceled?: boolean
      error?: string
    }> => ipcRenderer.invoke('image:import')
  },

  export: {
    render: (options: Record<string, unknown>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('export:render', options)
  },

  assets: {
    selectFolder: (): Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('assets:selectFolder'),
    listFiles: (dirPath: string): Promise<{ success: boolean; files?: Array<{ name: string; path: string; mtime: number; size: number }>; error?: string }> =>
      ipcRenderer.invoke('assets:listFiles', { dirPath })
  },

  /**
   * Subscribe to IPC events from the main process (e.g., 'menu:action').
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },

  /**
   * Remove all listeners for a given channel.
   */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  }
}

// ─── Expose to Renderer ───────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('picccAPI', api)

// ─── Type Declaration ─────────────────────────────────────────────────────────

export type PicccAPI = typeof api
