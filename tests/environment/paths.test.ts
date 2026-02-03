import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as os from 'os'

// We need to mock process.platform for some tests
const originalPlatform = process.platform

describe('getAppPaths', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.unstubAllEnvs()
  })

  it('should return all required path fields', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toBeDefined()
    expect(paths.data).toBeDefined()
    expect(paths.cache).toBeDefined()
    expect(paths.configFile).toBeDefined()
    expect(paths.venv).toBeDefined()
    expect(paths.python).toBeDefined()
  })

  it('should return absolute paths', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(path.isAbsolute(paths.config)).toBe(true)
    expect(path.isAbsolute(paths.data)).toBe(true)
    expect(path.isAbsolute(paths.cache)).toBe(true)
    expect(path.isAbsolute(paths.configFile)).toBe(true)
    expect(path.isAbsolute(paths.venv)).toBe(true)
    expect(path.isAbsolute(paths.python)).toBe(true)
  })

  it('should include picpocket in all paths', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toContain('picpocket')
    expect(paths.data).toContain('picpocket')
    expect(paths.cache).toContain('picpocket')
  })

  it('should have configFile inside config directory', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.configFile.startsWith(paths.config)).toBe(true)
    expect(paths.configFile.endsWith('.yaml')).toBe(true)
  })

  it('should have venv inside data directory', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.venv.startsWith(paths.data)).toBe(true)
    expect(paths.venv).toContain('venv')
  })

  it('should have python inside venv directory', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.python.startsWith(paths.venv)).toBe(true)
  })
})

describe('getAppPaths - macOS', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.unstubAllEnvs()
  })

  it('should use Library directories for data and cache', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.data).toContain('Library/Application Support')
    expect(paths.cache).toContain('Library/Caches')
  })

  it('should use .config for config (CLI tool convention)', async () => {
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toContain('.config')
  })

  it('should respect XDG_CONFIG_HOME on macOS', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/custom/config')
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toBe('/custom/config/picpocket')
  })
})

describe('getAppPaths - Linux', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.unstubAllEnvs()
  })

  it('should use XDG default directories', async () => {
    const home = os.homedir()
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toBe(path.join(home, '.config', 'picpocket'))
    expect(paths.data).toBe(path.join(home, '.local', 'share', 'picpocket'))
    expect(paths.cache).toBe(path.join(home, '.cache', 'picpocket'))
  })

  it('should respect XDG_CONFIG_HOME', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/custom/config')
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.config).toBe('/custom/config/picpocket')
  })

  it('should respect XDG_DATA_HOME', async () => {
    vi.stubEnv('XDG_DATA_HOME', '/custom/data')
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.data).toBe('/custom/data/picpocket')
  })

  it('should respect XDG_CACHE_HOME', async () => {
    vi.stubEnv('XDG_CACHE_HOME', '/custom/cache')
    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.cache).toBe('/custom/cache/picpocket')
  })
})

describe('getAppPaths - Windows', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(process, 'platform', { value: 'win32' })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.unstubAllEnvs()
  })

  it('should use AppData directories', async () => {
    vi.stubEnv('APPDATA', 'C:\\Users\\Test\\AppData\\Roaming')
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\Test\\AppData\\Local')

    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    // Note: path.join may use / or \ depending on host OS, so we check for key parts
    expect(paths.config).toContain('Roaming')
    expect(paths.config).toContain('picpocket')
    expect(paths.data).toContain('Local')
    expect(paths.data).toContain('picpocket')
    expect(paths.cache).toContain('Local')
    expect(paths.cache).toContain('cache')
  })

  it('should use .exe extension for python on Windows', async () => {
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\Test\\AppData\\Local')

    const { getAppPaths } = await import('../../src/environment/paths.js')
    const paths = getAppPaths()

    expect(paths.python).toContain('Scripts')
    expect(paths.python).toMatch(/python\.exe$/)
  })
})

describe('getLegacyPaths', () => {
  it('should return legacy path structure', async () => {
    const { getLegacyPaths } = await import('../../src/environment/paths.js')
    const home = os.homedir()
    const legacy = getLegacyPaths()

    expect(legacy.dir).toBe(path.join(home, '.picpocket'))
    expect(legacy.venv).toBe(path.join(home, '.picpocket', 'venv'))
    expect(legacy.config).toBe(path.join(home, '.picpocket.yaml'))
  })
})

describe('getPathsDescription', () => {
  it('should return formatted string with all paths', async () => {
    const { getPathsDescription } = await import('../../src/environment/paths.js')
    const description = getPathsDescription()

    expect(description).toContain('Config:')
    expect(description).toContain('Data:')
    expect(description).toContain('Cache:')
    expect(description).toContain('Venv:')
    expect(description).toContain('picpocket')
  })
})
