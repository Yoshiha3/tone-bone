import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const BUILD_DIR = join(ROOT_DIR, 'build')
const SVG_PATH = join(BUILD_DIR, 'icon.svg')
const MASTER_PNG_PATH = join(BUILD_DIR, 'icon.png')
const ICNS_PATH = join(BUILD_DIR, 'icon.icns')
const ICO_PATH = join(BUILD_DIR, 'icon.ico')
const ELECTRON_BIN = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
)

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ICONSET_SPECS = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 }
]

/**
 * Renders an SVG to a crisp transparent PNG at the given square pixel size
 * using the installed Electron Chromium engine (zero extra dependencies).
 */
function renderSvgToPng(svgContent, size, outputPath) {
  const tempDir = mkdtempSync(join(tmpdir(), 'onkai-icon-render-'))
  const mainScript = join(tempDir, 'render.cjs')
  const htmlFile = join(tempDir, 'icon.html')

  writeFileSync(
    htmlFile,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
      svg { display: block; width: ${size}px; height: ${size}px; }
    </style>
  </head>
  <body>${svgContent}</body>
</html>`,
    'utf-8'
  )

  writeFileSync(
    mainScript,
    `const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: ${size},
    height: ${size},
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadFile(${JSON.stringify(htmlFile)})
  await new Promise((r) => setTimeout(r, 150))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: ${size}, height: ${size} })
  writeFileSync(${JSON.stringify(outputPath)}, image.toPNG())
  app.quit()
})`,
    'utf-8'
  )

  const launchEnv = { ...process.env }
  delete launchEnv.ELECTRON_RUN_AS_NODE

  try {
    execFileSync(ELECTRON_BIN, [mainScript], { env: launchEnv, stdio: 'pipe' })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function resizePng(sourcePng, size, destPng) {
  execFileSync('sips', ['-z', String(size), String(size), sourcePng, '--out', destPng], {
    stdio: 'pipe'
  })
}

/**
 * Builds a standard multi-resolution Windows .ico file embedding PNG frames
 * (supported natively by Windows Vista+ and electron-builder).
 */
function buildIcoFromPngs(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // icon type
  header.writeUInt16LE(entries.length, 4)

  const dirSize = entries.length * 16
  let offset = 6 + dirSize
  const dirEntries = []
  const payloads = []

  for (const { size, buffer } of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2) // color palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    dirEntries.push(entry)
    payloads.push(buffer)
    offset += buffer.length
  }

  return Buffer.concat([header, ...dirEntries, ...payloads])
}

function main() {
  const svgContent = readFileSync(SVG_PATH, 'utf-8')
  mkdirSync(BUILD_DIR, { recursive: true })

  // 1. Render master PNG (supersampled on Retina displays) and normalize to 1024x1024
  renderSvgToPng(svgContent, 1024, MASTER_PNG_PATH)
  resizePng(MASTER_PNG_PATH, 1024, MASTER_PNG_PATH)
  console.log(`Generated ${MASTER_PNG_PATH}`)

  const workDir = mkdtempSync(join(tmpdir(), 'onkai-icon-build-'))
  try {
    // 2. Build macOS .icns via iconutil
    const iconsetDir = join(workDir, 'icon.iconset')
    mkdirSync(iconsetDir, { recursive: true })
    for (const spec of ICONSET_SPECS) {
      const dest = join(iconsetDir, spec.name)
      if (spec.size === 1024) {
        writeFileSync(dest, readFileSync(MASTER_PNG_PATH))
      } else {
        resizePng(MASTER_PNG_PATH, spec.size, dest)
      }
    }
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', ICNS_PATH], { stdio: 'pipe' })
    console.log(`Generated ${ICNS_PATH}`)

    // 3. Build Windows multi-size .ico
    const icoEntries = ICO_SIZES.map((size) => {
      const out = join(workDir, `ico-${size}.png`)
      resizePng(MASTER_PNG_PATH, size, out)
      return { size, buffer: readFileSync(out) }
    })
    writeFileSync(ICO_PATH, buildIcoFromPngs(icoEntries))
    console.log(`Generated ${ICO_PATH}`)
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()
