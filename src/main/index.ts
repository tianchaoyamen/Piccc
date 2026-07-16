import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  dialog,
  ipcMain,
  shell,
  protocol,
  net
} from 'electron'
import { pathToFileURL } from 'url'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs'
import { execFile, exec } from 'child_process'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
let mainWindow: BrowserWindow | null = null
let customRscriptPath: string | null = null



function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '皮克西西图表排版',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Application Menu (Chinese) ───────────────────────────────────────────────

function buildMenu(): void {
  const sendMenuAction = (action: string): void => {
    if (mainWindow) {
      mainWindow.webContents.send('menu:action', action)
    }
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new')
        },
        {
          label: '打开项目',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open')
        },
        { type: 'separator' },
        {
          label: '保存项目',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save')
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-as')
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo')
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendMenuAction('redo')
        },
        { type: 'separator' },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendMenuAction('zoom-in')
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendMenuAction('zoom-out')
        },
        {
          label: '实际大小',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendMenuAction('zoom-reset')
        },
        { type: 'separator' },
        {
          label: '全屏',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen())
            }
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 皮克西西图表排版',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于 皮克西西图表排版',
              message: '皮克西西图表排版',
              detail: `版本: ${app.getVersion()}\n科研图表排版工具 - Scientific Figure Layout Tool`
            })
          }
        }
      ]
    }
  ]

  // macOS: prepend app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 皮克西西图表排版' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 皮克西西图表排版' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 皮克西西图表排版' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function setupIpcHandlers(): void {
  // Project: New
  ipcMain.handle('project:new', async () => {
    return { success: true }
  })

  // Project: Open
  ipcMain.handle('project:open', async () => {
    if (!mainWindow) return { success: false, error: '窗口未就绪' }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开项目',
      filters: [
        { name: 'Piccc 项目文件', extensions: ['piccc'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const filePath = result.filePaths[0]
    try {
      const data = readFileSync(filePath, 'utf-8')
      return { success: true, filePath, data }
    } catch (err) {
      return { success: false, error: `无法读取文件: ${(err as Error).message}` }
    }
  })

  // Project: Save
  ipcMain.handle(
    'project:save',
    async (_event, { filePath, data }: { filePath: string; data: string }) => {
      try {
        writeFileSync(filePath, data, 'utf-8')
        return { success: true, filePath }
      } catch (err) {
        return { success: false, error: `无法保存文件: ${(err as Error).message}` }
      }
    }
  )

  // Project: Save As
  ipcMain.handle('project:save-as', async (_event, { data }: { data: string }) => {
    if (!mainWindow) return { success: false, error: '窗口未就绪' }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '另存为',
      defaultPath: 'untitled.piccc',
      filters: [
        { name: 'Piccc 项目文件', extensions: ['piccc'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      writeFileSync(result.filePath, data, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (err) {
      return { success: false, error: `无法保存文件: ${(err as Error).message}` }
    }
  })

  // R: Detect installation — returns { found, path, version }
  ipcMain.handle('r:detect', async () => {
    const rPath = await getActiveRscriptPath()
    if (!rPath) {
      return { found: false, path: '', version: '' }
    }

    // Get R version
    const version = await new Promise<string>((resolve) => {
      execFile(rPath, ['--version'], { timeout: 5000 }, (_error, _stdout, stderr) => {
        // Rscript --version outputs to stderr
        const match = (stderr || '').match(/R\s+(?:scripting front-end\s+)?version\s+([\d.]+)/i)
        resolve(match ? match[1] : '已安装')
      })
    })

    return { found: true, path: rPath, version }
  })

  // R: Set Custom Path
  ipcMain.handle('r:setCustomPath', async (_event, { path }: { path: string | null }) => {
    customRscriptPath = path
    const rPath = await getActiveRscriptPath()
    if (!rPath) {
      return { found: false, path: '', version: '' }
    }

    const version = await new Promise<string>((resolve) => {
      execFile(rPath, ['--version'], { timeout: 5000 }, (_error, _stdout, stderr) => {
        const match = (stderr || '').match(/R\s+(?:scripting front-end\s+)?version\s+([\d.]+)/i)
        resolve(match ? match[1] : '已安装')
      })
    })

    return { found: true, path: rPath, version }
  })

  // R: Select Executable
  ipcMain.handle('r:selectExecutable', async () => {
    if (!mainWindow) return { success: false, error: '窗口未就绪' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Rscript 可执行文件',
      properties: ['openFile'],
      filters: [
        { name: 'Rscript 可执行文件', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  // R: Execute code
  ipcMain.handle(
    'r:execute',
    async (
      _event,
      { code, width, height, dpi }: { code: string; width: number; height: number; dpi: number }
    ) => {
      // Detect R first
      const rDetect = await getActiveRscriptPath()
      if (!rDetect) {
        return { success: false, error: '未检测到 Rscript，请先安装 R。' }
      }

      const sessionId = randomUUID()
      const scriptPath = join(tmpdir(), `piccc_script_${sessionId}.R`)
      const outputPath = join(tmpdir(), `piccc_output_${sessionId}.png`)

      // Wrap R code with PNG device
      const wrappedCode = [
        `png('${outputPath.replace(/\\/g, '/')}', width=${width}, height=${height}, res=${dpi}, units='in')`,
        code,
        'dev.off()'
      ].join('\n')

      try {
        writeFileSync(scriptPath, wrappedCode, 'utf-8')

        await new Promise<void>((resolve, reject) => {
          execFile(rDetect, [scriptPath], { timeout: 30000 }, (error, _stdout, stderr) => {
            if (error) {
              if ((error as NodeJS.ErrnoException).killed) {
                reject(new Error('R 脚本执行超时（30秒限制）'))
              } else {
                reject(new Error(`R 执行错误: ${stderr || error.message}`))
              }
            } else {
              resolve()
            }
          })
        })

        // Read output image and convert to base64 data URL
        if (!existsSync(outputPath)) {
          return { success: false, error: 'R 脚本未生成输出图像。' }
        }

        const imageBuffer = readFileSync(outputPath)
        const base64 = imageBuffer.toString('base64')
        const dataUrl = `data:image/png;base64,${base64}`

        return { success: true, dataUrl }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      } finally {
        // Clean up temp files
        try {
          if (existsSync(scriptPath)) unlinkSync(scriptPath)
        } catch {
          // ignore cleanup errors
        }
        try {
          if (existsSync(outputPath)) unlinkSync(outputPath)
        } catch {
          // ignore cleanup errors
        }
      }
    }
  )

  // Image: Import
  ipcMain.handle('image:import', async () => {
    if (!mainWindow) return { success: false, error: '窗口未就绪' }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入图片',
      filters: [
        {
          name: '图片文件',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'svg', 'webp']
        },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    return { success: true, paths: result.filePaths }
  })

  // Assets: Select Folder
  ipcMain.handle('assets:selectFolder', async () => {
    if (!mainWindow) return { success: false, error: '窗口未就绪' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择素材库文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  // Assets: List Files
  ipcMain.handle('assets:listFiles', async (_event, { dirPath }: { dirPath: string }) => {
    try {
      if (!dirPath) return { success: false, error: '未指定路径' }
      
      // Auto-create default path if it doesn't exist
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
      }

      const files = readdirSync(dirPath)
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.svg', '.webp']
      
      const fileList = files
        .filter(file => {
          const lower = file.toLowerCase()
          return imageExtensions.some(ext => lower.endsWith(ext))
        })
        .map(file => {
          const fullPath = join(dirPath, file)
          const stat = statSync(fullPath)
          return {
            name: file,
            path: fullPath,
            mtime: stat.mtimeMs,
            size: stat.size
          }
        })

      return { success: true, files: fileList }
    } catch (err: any) {
      return { success: false, error: err.message || '读取素材库失败' }
    }
  })

  // Dialog: Message
  ipcMain.handle(
    'dialog:message',
    async (
      _event,
      options: {
        type?: 'none' | 'info' | 'error' | 'question' | 'warning'
        title?: string
        message: string
        detail?: string
        buttons?: string[]
      }
    ) => {
      if (!mainWindow) return { success: false, error: '窗口未就绪' }

      const result = await dialog.showMessageBox(mainWindow, {
        type: options.type || 'info',
        title: options.title || 'Piccc',
        message: options.message,
        detail: options.detail,
        buttons: options.buttons || ['确定']
      })

      return { success: true, response: result.response }
    }
  )

  // Export: Render and Save
  ipcMain.handle(
    'export:render',
    async (
      _event,
      { dataUrl, format, defaultName, defaultExportPath }: { dataUrl: string; format: 'png' | 'jpeg' | 'tiff'; defaultName: string; defaultExportPath?: string }
    ) => {
      if (!mainWindow) return { success: false, error: '窗口未就绪' }

      const extension = format === 'jpeg' ? 'jpg' : format
      let defaultPath = `${defaultName}.${extension}`
      if (defaultExportPath && existsSync(defaultExportPath)) {
        defaultPath = join(defaultExportPath, defaultPath)
      }

      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出排版图',
        defaultPath,
        filters: [
          {
            name: `${format.toUpperCase()} 图片`,
            extensions: [extension]
          }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      try {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        writeFileSync(result.filePath, buffer)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message || err }
      }
    }
  )
}

/**
 * Helper: get active Rscript path (checking custom path first).
 */
async function getActiveRscriptPath(): Promise<string | null> {
  if (customRscriptPath && existsSync(customRscriptPath)) {
    return customRscriptPath
  }
  return detectRscriptPath()
}

/**
 * Helper: detect Rscript path.
 * Returns the path string if found, or null.
 */
async function detectRscriptPath(): Promise<string | null> {
  const commonPaths = [
    '/usr/local/bin/Rscript',
    '/usr/bin/Rscript',
    '/opt/homebrew/bin/Rscript'
  ]

  for (const rPath of commonPaths) {
    if (existsSync(rPath)) {
      return rPath
    }
  }

  const whichCmd = process.platform === 'win32' ? 'where' : 'which'

  return new Promise<string | null>((resolve) => {
    exec(`${whichCmd} Rscript`, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(null)
      } else {
        resolve(stdout.trim().split('\n')[0])
      }
    })
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {


  buildMenu()
  setupIpcHandlers()
  createWindow()

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until the user quits explicitly with Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
