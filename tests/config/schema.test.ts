import { describe, it, expect } from 'vitest'
import {
  CategorySchema,
  ClassificationConfigSchema,
  OutputConfigSchema,
  ConfigSchema,
} from '../../src/config/schema.js'

describe('CategorySchema', () => {
  it('should accept valid category', () => {
    const valid = {
      name: 'People',
      prompts: ['a photo of a person', 'a selfie'],
    }
    expect(() => CategorySchema.parse(valid)).not.toThrow()
  })

  it('should reject empty name', () => {
    const invalid = {
      name: '',
      prompts: ['a photo'],
    }
    expect(() => CategorySchema.parse(invalid)).toThrow()
  })

  it('should reject empty prompts array', () => {
    const invalid = {
      name: 'People',
      prompts: [],
    }
    expect(() => CategorySchema.parse(invalid)).toThrow()
  })

  it('should reject prompts with empty strings', () => {
    const invalid = {
      name: 'People',
      prompts: ['valid prompt', ''],
    }
    expect(() => CategorySchema.parse(invalid)).toThrow()
  })
})

describe('ClassificationConfigSchema', () => {
  it('should accept valid config', () => {
    const valid = {
      model: 'openai/clip-vit-large-patch14',
      threshold: 0.7,
      topK: 3,
    }
    const result = ClassificationConfigSchema.parse(valid)
    expect(result.model).toBe('openai/clip-vit-large-patch14')
    expect(result.threshold).toBe(0.7)
    expect(result.topK).toBe(3)
  })

  it('should use defaults for missing fields', () => {
    const result = ClassificationConfigSchema.parse({})
    expect(result.model).toBe('openai/clip-vit-large-patch14')
    expect(result.threshold).toBe(0.0)
    expect(result.topK).toBe(3)
  })

  it('should reject threshold below 0', () => {
    const invalid = { threshold: -0.1 }
    expect(() => ClassificationConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject threshold above 1', () => {
    const invalid = { threshold: 1.5 }
    expect(() => ClassificationConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject topK below 1', () => {
    const invalid = { topK: 0 }
    expect(() => ClassificationConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject topK above 10', () => {
    const invalid = { topK: 11 }
    expect(() => ClassificationConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject non-integer topK', () => {
    const invalid = { topK: 2.5 }
    expect(() => ClassificationConfigSchema.parse(invalid)).toThrow()
  })
})

describe('OutputConfigSchema', () => {
  it('should accept valid config', () => {
    const valid = {
      mode: 'move',
      duplicateHandling: 'overwrite',
    }
    const result = OutputConfigSchema.parse(valid)
    expect(result.mode).toBe('move')
    expect(result.duplicateHandling).toBe('overwrite')
  })

  it('should use defaults for missing fields', () => {
    const result = OutputConfigSchema.parse({})
    expect(result.mode).toBe('copy')
    expect(result.duplicateHandling).toBe('rename')
  })

  it('should reject invalid mode', () => {
    const invalid = { mode: 'link' }
    expect(() => OutputConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject invalid duplicateHandling', () => {
    const invalid = { duplicateHandling: 'delete' }
    expect(() => OutputConfigSchema.parse(invalid)).toThrow()
  })

  it('should accept all valid mode values', () => {
    expect(() => OutputConfigSchema.parse({ mode: 'copy' })).not.toThrow()
    expect(() => OutputConfigSchema.parse({ mode: 'move' })).not.toThrow()
  })

  it('should accept all valid duplicateHandling values', () => {
    expect(() => OutputConfigSchema.parse({ duplicateHandling: 'rename' })).not.toThrow()
    expect(() => OutputConfigSchema.parse({ duplicateHandling: 'skip' })).not.toThrow()
    expect(() => OutputConfigSchema.parse({ duplicateHandling: 'overwrite' })).not.toThrow()
  })
})

describe('ConfigSchema', () => {
  it('should accept valid complete config', () => {
    const valid = {
      version: 1,
      categories: [
        { name: 'People', prompts: ['a person'] },
        { name: 'Animals', prompts: ['an animal'] },
      ],
      classification: {
        model: 'openai/clip-vit-base-patch32',
        threshold: 0.5,
        topK: 5,
      },
      output: {
        mode: 'move',
        duplicateHandling: 'skip',
      },
    }
    const result = ConfigSchema.parse(valid)
    expect(result.version).toBe(1)
    expect(result.categories).toHaveLength(2)
    expect(result.classification.model).toBe('openai/clip-vit-base-patch32')
    expect(result.output.mode).toBe('move')
  })

  it('should use defaults for nested objects', () => {
    const minimal = {
      categories: [{ name: 'Test', prompts: ['test prompt'] }],
    }
    const result = ConfigSchema.parse(minimal)
    expect(result.version).toBe(1)
    expect(result.classification.model).toBe('openai/clip-vit-large-patch14')
    expect(result.output.mode).toBe('copy')
  })

  it('should reject config without categories', () => {
    const invalid = {
      version: 1,
    }
    expect(() => ConfigSchema.parse(invalid)).toThrow()
  })

  it('should reject empty categories array', () => {
    const invalid = {
      categories: [],
    }
    expect(() => ConfigSchema.parse(invalid)).toThrow()
  })
})
