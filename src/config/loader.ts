import * as nodeFs from 'fs'
import fs from 'fs-extra'
import * as path from 'path'
import * as yaml from 'yaml'
import { ConfigSchema, type Config, type Category } from './schema.js'
import { DEFAULT_CATEGORIES, DEFAULT_MODEL, DEFAULT_THRESHOLD, DEFAULT_TOP_K } from './defaults.js'
import { getAppPaths, getLegacyPaths } from '../environment/paths.js'

export function getDefaultConfigPath(): string {
  return getAppPaths().configFile
}

// Export for backward compatibility
export const DEFAULT_CONFIG_PATH = getDefaultConfigPath()

export function getDefaultConfig(): Config {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    classification: {
      model: DEFAULT_MODEL,
      threshold: DEFAULT_THRESHOLD,
      topK: DEFAULT_TOP_K,
    },
    output: {
      mode: 'copy',
      duplicateHandling: 'rename',
    },
  }
}

export async function loadConfig(configPath?: string): Promise<Config> {
  // If explicit path provided, use it
  if (configPath) {
    return loadConfigFromPath(configPath)
  }

  // Check standard path first
  const standardPath = getAppPaths().configFile
  if (await fs.pathExists(standardPath)) {
    return loadConfigFromPath(standardPath)
  }

  // Check legacy path for backward compatibility
  const legacyPath = getLegacyPaths().config
  if (await fs.pathExists(legacyPath)) {
    return loadConfigFromPath(legacyPath)
  }

  // Return defaults if no config found
  return getDefaultConfig()
}

async function loadConfigFromPath(filePath: string): Promise<Config> {
  try {
    const content = nodeFs.readFileSync(filePath, 'utf-8')
    const parsed = yaml.parse(content)

    if (!parsed || typeof parsed !== 'object') {
      return getDefaultConfig()
    }

    const merged = mergeWithDefaults(parsed)
    return ConfigSchema.parse(merged)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${filePath}: ${error.message}`)
    }
    throw error
  }
}

function mergeWithDefaults(parsed: Record<string, unknown>): Record<string, unknown> {
  const defaults = getDefaultConfig()

  return {
    version: parsed.version ?? defaults.version,
    categories: parsed.categories ?? defaults.categories,
    classification: {
      ...defaults.classification,
      ...(parsed.classification as Record<string, unknown> || {}),
    },
    output: {
      ...defaults.output,
      ...(parsed.output as Record<string, unknown> || {}),
    },
  }
}

export async function saveConfig(config: Config, configPath?: string): Promise<void> {
  const filePath = configPath || getAppPaths().configFile

  // Ensure config directory exists
  await fs.ensureDir(path.dirname(filePath))

  const content = yaml.stringify(config)
  nodeFs.writeFileSync(filePath, content, 'utf-8')
}

export function categoriesToMap(categories: Category[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const cat of categories) {
    result[cat.name] = cat.prompts
  }
  return result
}

export function generateDefaultConfigYaml(): string {
  const config = getDefaultConfig()
  return yaml.stringify(config)
}
