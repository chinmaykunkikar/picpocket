import { spawn, execSync } from 'child_process'
import * as path from 'path'
import * as nodeFs from 'fs'
import * as fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { getAppPaths, getLegacyPaths, type AppPaths } from './paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface SetupOptions {
  onStatus?: (message: string) => void
  force?: boolean
}

export function getVenvPython(): string {
  return getAppPaths().python
}

export function getDataDir(): string {
  return getAppPaths().data
}

export function getConfigDir(): string {
  return getAppPaths().config
}

export function getCacheDir(): string {
  return getAppPaths().cache
}

export async function isUvInstalled(): Promise<boolean> {
  try {
    execSync('uv --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export async function isVenvSetup(): Promise<boolean> {
  const paths = getAppPaths()
  return fs.pathExists(paths.python)
}

export async function isDependenciesInstalled(): Promise<boolean> {
  if (!await isVenvSetup()) {
    return false
  }

  const paths = getAppPaths()
  try {
    execSync(`"${paths.python}" -c "import torch; import transformers; import PIL"`, {
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

function getRequirementsPath(): string {
  const distPath = path.join(__dirname, '..', '..', 'python', 'requirements.txt')
  const srcPath = path.join(__dirname, '..', '..', '..', 'python', 'requirements.txt')

  if (nodeFs.existsSync(distPath)) {
    return distPath
  }
  return srcPath
}

export async function migrateLegacyPaths(options: { onStatus?: (message: string) => void } = {}): Promise<boolean> {
  const { onStatus = () => {} } = options
  const legacy = getLegacyPaths()
  const current = getAppPaths()

  let migrated = false

  // Check for legacy venv
  if (await fs.pathExists(legacy.venv) && !await fs.pathExists(current.venv)) {
    onStatus(`Migrating venv from ${legacy.venv} to ${current.venv}...`)
    await fs.ensureDir(path.dirname(current.venv))
    await fs.move(legacy.venv, current.venv)
    migrated = true
  }

  // Check for legacy config
  if (await fs.pathExists(legacy.config) && !await fs.pathExists(current.configFile)) {
    onStatus(`Migrating config from ${legacy.config} to ${current.configFile}...`)
    await fs.ensureDir(path.dirname(current.configFile))
    await fs.move(legacy.config, current.configFile)
    migrated = true
  }

  // Clean up empty legacy directory
  if (await fs.pathExists(legacy.dir)) {
    const contents = nodeFs.readdirSync(legacy.dir)
    if (contents.length === 0) {
      await fs.remove(legacy.dir)
    }
  }

  return migrated
}

export async function setupEnvironment(options: SetupOptions = {}): Promise<void> {
  const { onStatus = () => {}, force = false } = options
  const paths = getAppPaths()

  // Migrate from legacy paths first
  await migrateLegacyPaths({ onStatus })

  // Check if already setup
  if (!force && await isDependenciesInstalled()) {
    onStatus('Python environment already configured')
    return
  }

  // Check for uv
  if (!await isUvInstalled()) {
    throw new Error(
      'uv is not installed. Install it with:\n' +
      '  curl -LsSf https://astral.sh/uv/install.sh | sh\n' +
      'Or visit: https://github.com/astral-sh/uv'
    )
  }

  // Create data directory
  await fs.ensureDir(paths.data)

  // Create virtual environment
  onStatus('Creating virtual environment...')

  if (force && await fs.pathExists(paths.venv)) {
    await fs.remove(paths.venv)
  }

  await runCommand('uv', ['venv', paths.venv], { onStatus })

  // Install dependencies
  onStatus('Installing Python dependencies (this may take a few minutes)...')

  const requirementsPath = getRequirementsPath()

  await runCommand('uv', [
    'pip', 'install',
    '--python', paths.python,
    '-r', requirementsPath,
  ], { onStatus })

  onStatus('Python environment setup complete')
}

export interface CleanupOptions {
  onStatus?: (message: string) => void
  /** Remove virtual environment */
  venv?: boolean
  /** Remove config file */
  config?: boolean
  /** Remove cache directory */
  cache?: boolean
  /** Remove everything (venv + config + cache) */
  all?: boolean
}

export interface CleanupResult {
  venvRemoved: boolean
  configRemoved: boolean
  cacheRemoved: boolean
  bytesFreed: number
}

async function getDirectorySize(dir: string): Promise<number> {
  if (!await fs.pathExists(dir)) {
    return 0
  }

  let size = 0
  const files = nodeFs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    const filePath = path.join(dir, file.name)
    if (file.isDirectory()) {
      size += await getDirectorySize(filePath)
    } else {
      const stat = nodeFs.statSync(filePath)
      size += stat.size
    }
  }

  return size
}

export async function cleanupEnvironment(options: CleanupOptions = {}): Promise<CleanupResult> {
  const { onStatus = () => {} } = options
  const paths = getAppPaths()

  // Default to venv only if no specific option given
  const removeVenv = options.all || options.venv || (!options.config && !options.cache)
  const removeConfig = options.all || options.config
  const removeCache = options.all || options.cache

  const result: CleanupResult = {
    venvRemoved: false,
    configRemoved: false,
    cacheRemoved: false,
    bytesFreed: 0,
  }

  if (removeVenv && await fs.pathExists(paths.venv)) {
    const size = await getDirectorySize(paths.venv)
    onStatus('Removing virtual environment...')
    await fs.remove(paths.venv)
    result.venvRemoved = true
    result.bytesFreed += size

    // Clean up empty data directory
    if (await fs.pathExists(paths.data)) {
      const contents = nodeFs.readdirSync(paths.data)
      if (contents.length === 0) {
        await fs.remove(paths.data)
      }
    }
  }

  if (removeConfig && await fs.pathExists(paths.configFile)) {
    const stat = await fs.stat(paths.configFile)
    onStatus('Removing config file...')
    await fs.remove(paths.configFile)
    result.configRemoved = true
    result.bytesFreed += stat.size

    // Clean up empty config directory
    if (await fs.pathExists(paths.config)) {
      const contents = nodeFs.readdirSync(paths.config)
      if (contents.length === 0) {
        await fs.remove(paths.config)
      }
    }
  }

  if (removeCache && await fs.pathExists(paths.cache)) {
    const size = await getDirectorySize(paths.cache)
    onStatus('Removing cache...')
    await fs.remove(paths.cache)
    result.cacheRemoved = true
    result.bytesFreed += size
  }

  return result
}

export async function getEnvironmentInfo(): Promise<{
  uvInstalled: boolean
  uvVersion?: string
  venvExists: boolean
  paths: AppPaths
  dependenciesInstalled: boolean
  venvSize?: number
  cacheSize?: number
  legacyPathsExist: boolean
}> {
  const uvInstalled = await isUvInstalled()
  let uvVersion: string | undefined

  if (uvInstalled) {
    try {
      uvVersion = execSync('uv --version', { encoding: 'utf-8' }).trim()
    } catch {
      // Ignore
    }
  }

  const paths = getAppPaths()
  const venvExists = await isVenvSetup()
  const dependenciesInstalled = await isDependenciesInstalled()

  let venvSize: number | undefined
  let cacheSize: number | undefined

  if (venvExists) {
    venvSize = await getDirectorySize(paths.venv)
  }

  if (await fs.pathExists(paths.cache)) {
    cacheSize = await getDirectorySize(paths.cache)
  }

  // Check for legacy paths
  const legacy = getLegacyPaths()
  const legacyPathsExist = await fs.pathExists(legacy.venv) || await fs.pathExists(legacy.config)

  return {
    uvInstalled,
    uvVersion,
    venvExists,
    paths,
    dependenciesInstalled,
    venvSize,
    cacheSize,
    legacyPathsExist,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function runCommand(
  command: string,
  args: string[],
  options: { onStatus?: (message: string) => void } = {}
): Promise<void> {
  const { onStatus = () => {} } = options

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n')
      for (const line of lines) {
        if (line.trim()) {
          onStatus(line.trim())
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to run command: ${err.message}`))
    })
  })
}
