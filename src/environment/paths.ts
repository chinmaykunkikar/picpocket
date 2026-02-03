import * as path from 'path'
import * as os from 'os'

const APP_NAME = 'picpocket'

/**
 * Get platform-specific directories following:
 * - Linux: XDG Base Directory Specification
 * - macOS: Apple's standard directories (with XDG fallback for config)
 * - Windows: %LOCALAPPDATA% and %APPDATA%
 */

function getLinuxPaths() {
  const home = os.homedir()

  return {
    // XDG_CONFIG_HOME or ~/.config
    config: path.join(
      process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
      APP_NAME
    ),
    // XDG_DATA_HOME or ~/.local/share
    data: path.join(
      process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'),
      APP_NAME
    ),
    // XDG_CACHE_HOME or ~/.cache
    cache: path.join(
      process.env.XDG_CACHE_HOME || path.join(home, '.cache'),
      APP_NAME
    ),
  }
}

function getMacOSPaths() {
  const home = os.homedir()

  return {
    // Use XDG_CONFIG_HOME if set, otherwise ~/.config (common for CLI tools)
    config: path.join(
      process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
      APP_NAME
    ),
    // ~/Library/Application Support
    data: path.join(home, 'Library', 'Application Support', APP_NAME),
    // ~/Library/Caches
    cache: path.join(home, 'Library', 'Caches', APP_NAME),
  }
}

function getWindowsPaths() {
  const home = os.homedir()

  // %APPDATA% = C:\Users\<user>\AppData\Roaming
  // %LOCALAPPDATA% = C:\Users\<user>\AppData\Local
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')

  return {
    // %APPDATA%\picpocket (roaming config)
    config: path.join(appData, APP_NAME),
    // %LOCALAPPDATA%\picpocket (local data, not roamed)
    data: path.join(localAppData, APP_NAME),
    // %LOCALAPPDATA%\picpocket\cache
    cache: path.join(localAppData, APP_NAME, 'cache'),
  }
}

export interface AppPaths {
  /** Directory for config files */
  config: string
  /** Directory for application data (venv lives here) */
  data: string
  /** Directory for cache files */
  cache: string
  /** Full path to config file */
  configFile: string
  /** Full path to venv directory */
  venv: string
  /** Full path to venv Python executable */
  python: string
}

export function getAppPaths(): AppPaths {
  let basePaths: { config: string; data: string; cache: string }

  switch (process.platform) {
    case 'win32':
      basePaths = getWindowsPaths()
      break
    case 'darwin':
      basePaths = getMacOSPaths()
      break
    default:
      // Linux and other Unix-like systems
      basePaths = getLinuxPaths()
  }

  const venvDir = path.join(basePaths.data, 'venv')

  return {
    ...basePaths,
    configFile: path.join(basePaths.config, 'config.yaml'),
    venv: venvDir,
    python: process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python'),
  }
}

/**
 * Get human-readable description of where files are stored
 */
export function getPathsDescription(): string {
  const paths = getAppPaths()
  const lines = [
    `Config:  ${paths.configFile}`,
    `Data:    ${paths.data}`,
    `Cache:   ${paths.cache}`,
    `Venv:    ${paths.venv}`,
  ]
  return lines.join('\n')
}

/**
 * Legacy path for migration (was ~/.picpocket)
 */
export function getLegacyPaths(): { dir: string; venv: string; config: string } {
  const home = os.homedir()
  const legacyDir = path.join(home, '.picpocket')
  return {
    dir: legacyDir,
    venv: path.join(legacyDir, 'venv'),
    config: path.join(home, '.picpocket.yaml'),
  }
}
