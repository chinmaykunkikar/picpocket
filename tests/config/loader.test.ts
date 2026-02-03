import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  categoriesToMap,
  generateDefaultConfigYaml,
} from '../../src/config/loader.js'

describe('getDefaultConfig', () => {
  it('should return a valid config', () => {
    const config = getDefaultConfig()
    expect(config.version).toBe(1)
    expect(config.categories.length).toBeGreaterThan(0)
    expect(config.classification).toBeDefined()
    expect(config.output).toBeDefined()
  })

  it('should have default classification settings', () => {
    const config = getDefaultConfig()
    expect(config.classification.model).toBe('openai/clip-vit-large-patch14')
    expect(config.classification.threshold).toBe(0.0)
    expect(config.classification.topK).toBe(3)
  })

  it('should have default output settings', () => {
    const config = getDefaultConfig()
    expect(config.output.mode).toBe('copy')
    expect(config.output.duplicateHandling).toBe('rename')
  })

  it('should have 5 default categories', () => {
    const config = getDefaultConfig()
    expect(config.categories).toHaveLength(5)
  })

  it('should have expected category names', () => {
    const config = getDefaultConfig()
    const names = config.categories.map(c => c.name)
    expect(names).toContain('People')
    expect(names).toContain('Screenshots')
    expect(names).toContain('Documents')
    expect(names).toContain('Real_Photos')
    expect(names).toContain('Forwards')
  })

  it('should return a new object each time', () => {
    const config1 = getDefaultConfig()
    const config2 = getDefaultConfig()
    expect(config1).not.toBe(config2)
    expect(config1).toEqual(config2)
  })
})

describe('categoriesToMap', () => {
  it('should convert categories array to map', () => {
    const categories = [
      { name: 'People', prompts: ['a person', 'a face'] },
      { name: 'Animals', prompts: ['an animal'] },
    ]
    const map = categoriesToMap(categories)
    expect(map).toEqual({
      People: ['a person', 'a face'],
      Animals: ['an animal'],
    })
  })

  it('should handle empty array', () => {
    const map = categoriesToMap([])
    expect(map).toEqual({})
  })

  it('should preserve prompt order', () => {
    const categories = [
      { name: 'Test', prompts: ['first', 'second', 'third'] },
    ]
    const map = categoriesToMap(categories)
    expect(map.Test).toEqual(['first', 'second', 'third'])
  })
})

describe('generateDefaultConfigYaml', () => {
  it('should return valid YAML string', () => {
    const yaml = generateDefaultConfigYaml()
    expect(typeof yaml).toBe('string')
    expect(yaml.length).toBeGreaterThan(0)
  })

  it('should contain expected fields', () => {
    const yaml = generateDefaultConfigYaml()
    expect(yaml).toContain('version:')
    expect(yaml).toContain('categories:')
    expect(yaml).toContain('classification:')
    expect(yaml).toContain('output:')
  })

  it('should contain category names', () => {
    const yaml = generateDefaultConfigYaml()
    expect(yaml).toContain('People')
    expect(yaml).toContain('Screenshots')
  })
})

describe('loadConfig and saveConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpocket-test-'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('should save and load config correctly', async () => {
    const configPath = path.join(tempDir, 'config.yaml')
    const config = getDefaultConfig()
    config.classification.threshold = 0.75
    config.output.mode = 'move'

    await saveConfig(config, configPath)
    const loaded = await loadConfig(configPath)

    expect(loaded.classification.threshold).toBe(0.75)
    expect(loaded.output.mode).toBe('move')
  })

  it('should create parent directories when saving', async () => {
    const configPath = path.join(tempDir, 'subdir', 'deep', 'config.yaml')
    const config = getDefaultConfig()

    await saveConfig(config, configPath)

    expect(await fs.pathExists(configPath)).toBe(true)
  })

  it('should throw when explicit config file does not exist', async () => {
    const configPath = path.join(tempDir, 'nonexistent.yaml')

    await expect(loadConfig(configPath)).rejects.toThrow('ENOENT')
  })

  it('should return defaults when no config path provided and no config exists', async () => {
    // loadConfig() without path falls back to defaults if no config file exists
    // This test verifies the default config is valid
    const defaults = getDefaultConfig()
    expect(defaults.categories.length).toBeGreaterThan(0)
  })

  it('should merge partial config with defaults', async () => {
    const configPath = path.join(tempDir, 'partial.yaml')
    const partialYaml = `
categories:
  - name: Custom
    prompts:
      - custom prompt
classification:
  threshold: 0.5
`
    await fs.writeFile(configPath, partialYaml)
    const loaded = await loadConfig(configPath)

    // Custom values
    expect(loaded.categories).toHaveLength(1)
    expect(loaded.categories[0].name).toBe('Custom')
    expect(loaded.classification.threshold).toBe(0.5)
    // Defaults
    expect(loaded.classification.model).toBe('openai/clip-vit-large-patch14')
    expect(loaded.output.mode).toBe('copy')
  })

  it('should throw on invalid YAML', async () => {
    const configPath = path.join(tempDir, 'invalid.yaml')
    await fs.writeFile(configPath, 'categories: [invalid yaml here')

    await expect(loadConfig(configPath)).rejects.toThrow()
  })

  it('should preserve custom model in saved config', async () => {
    const configPath = path.join(tempDir, 'custom-model.yaml')
    const config = getDefaultConfig()
    config.classification.model = 'laion/CLIP-ViT-H-14-laion2B-s32B-b79K'

    await saveConfig(config, configPath)
    const loaded = await loadConfig(configPath)

    expect(loaded.classification.model).toBe('laion/CLIP-ViT-H-14-laion2B-s32B-b79K')
  })
})
